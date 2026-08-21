import { useEffect, useMemo, useState } from 'react';
import AdminAudit from './AdminAudit';

// In production, set VITE_API_BASE to your deployed backend's URL
// (e.g. https://your-backend.onrender.com) when building the frontend.
// Locally, it falls back to your backend running on port 8000.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function formatSlot(dateStr) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateStr));
}

function getDefaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().split('T')[0];
}

function normalizeAppointmentStatus(status) {
  const mapping = {
    confirmed: 'Confirmed',
    waiting: 'Waiting',
    checked_in: 'Checked In',
    checkedin: 'Checked In',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  return mapping[String(status || '').toLowerCase()] || 'Confirmed';
}

const initialAppointments = [
  { id: 'A-101', patient: 'Maya Singh', time: '2026-08-14T09:00:00.000Z', status: 'Confirmed' },
  { id: 'A-102', patient: 'James Walker', time: '2026-08-14T10:30:00.000Z', status: 'Checked In' },
  { id: 'A-103', patient: 'Nina Patel', time: '2026-08-14T13:15:00.000Z', status: 'Waiting' },
  { id: 'A-104', patient: 'Chris Moore', time: '2026-08-14T15:00:00.000Z', status: 'Confirmed' }
];

export default function App() {
  const [activeView, setActiveView] = useState('patient');
  const [email, setEmail] = useState('patient@example.com');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
  const [token, setToken] = useState('');
  const [authMessage, setAuthMessage] = useState('Not signed in.');
  const [date, setDate] = useState(getDefaultDate());
  const [rangeStart, setRangeStart] = useState(getDefaultDate());
  const [rangeEnd, setRangeEnd] = useState(getDefaultDate());
  const [clinics, setClinics] = useState([]);
  const [activeClinic, setActiveClinic] = useState('');
  const [patientClinics, setPatientClinics] = useState([]);
  const [selectedPatientClinic, setSelectedPatientClinic] = useState('');
  const [locateStatus, setLocateStatus] = useState('Not searched yet.');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingStatus, setBookingStatus] = useState('');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  });
  const [appointments, setAppointments] = useState(initialAppointments);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const requestConfig = useMemo(
    () => ({
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    }),
    [token]
  );

  async function fetchProviderAppointments() {
    if (!token) return;

    try {
      const params = new URLSearchParams();
      // The backend forces provider_id to req.user.providerId for provider
      // role regardless of what's sent, so we don't need to pass it here.
      if (activeClinic) params.set('clinic_id', activeClinic);
      if (rangeStart) params.set('start', `${rangeStart}T00:00:00.000Z`);
      if (rangeEnd) params.set('end', `${rangeEnd}T23:59:59.999Z`);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`${API_BASE}/appointments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Unable to load schedule');

      const nextAppointments = (Array.isArray(data) ? data : []).map((appt) => ({
        id: appt.id,
        patient: [appt.patient_first_name, appt.patient_last_name].filter(Boolean).join(' ') || 'Unknown patient',
        time: appt.start_ts || new Date().toISOString(),
        status: normalizeAppointmentStatus(appt.status)
      }));

      setAppointments(nextAppointments.length > 0 ? nextAppointments : initialAppointments);
    } catch (error) {
      setAppointments(initialAppointments);
      setAuthMessage(error.message);
    }
  }

  async function fetchProviderClinics() {
    if (!token || role !== 'provider') return;
    try {
      const res = await fetch(`${API_BASE}/providers/me/clinics`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load clinics');
      const data = await res.json();
      setClinics(data || []);
      if (data && data.length > 0) setActiveClinic(data[0].id);
    } catch (err) {
      setClinics([]);
    }
  }

  async function fetchAllClinics() {
    try {
      const res = await fetch(`${API_BASE}/clinics`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load clinics');
      setPatientClinics(data || []);
      if (data && data.length > 0) setSelectedPatientClinic(data[0].id);
      setLocateStatus(`Showing all ${data.length} clinics.`);
    } catch (error) {
      setPatientClinics([]);
      setLocateStatus(error.message);
    }
  }

  async function fetchNearbyClinics(lat, lng) {
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radius_km: '25', limit: '20' });
      const res = await fetch(`${API_BASE}/clinics/nearby?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.msg || data.error || 'Unable to load nearby clinics');

      if (!data || data.length === 0) {
        setLocateStatus('No clinics found within 25km — showing all clinics instead.');
        await fetchAllClinics();
        return;
      }

      setPatientClinics(data);
      setSelectedPatientClinic(data[0].id);
      setLocateStatus(`Found ${data.length} clinic(s) near you, nearest first.`);
    } catch (error) {
      setLocateStatus(`${error.message} — showing all clinics instead.`);
      await fetchAllClinics();
    }
  }

  function findNearbyClinics() {
    if (!navigator.geolocation) {
      setLocateStatus('Geolocation is not available in this browser — showing all clinics instead.');
      fetchAllClinics();
      return;
    }

    setLocateStatus('Locating you…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchNearbyClinics(latitude, longitude);
      },
      () => {
        setLocateStatus('Location permission denied — showing all clinics instead.');
        fetchAllClinics();
      },
      { timeout: 8000 }
    );
  }

  // Try to find nearby clinics for the patient as soon as the app loads —
  // this is a public endpoint, so it works before the patient signs in.
  useEffect(() => {
    findNearbyClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (activeView === 'provider' && token && role === 'provider') {
      fetchProviderAppointments();
    }
  }, [activeView, token, role]);

  useEffect(() => {
    if (activeView === 'provider' && token && role === 'provider') fetchProviderClinics();
  }, [activeView, token, role]);

  async function onProviderDateRangeChange() {
    setPage(1);
    await fetchProviderAppointments();
  }

  async function exportCsv() {
    if (!token) return setAuthMessage('Please sign in first.');

    const params = new URLSearchParams();
    if (activeClinic) params.set('clinic_id', activeClinic);
    if (rangeStart) params.set('start', `${rangeStart}T00:00:00.000Z`);
    if (rangeEnd) params.set('end', `${rangeEnd}T23:59:59.999Z`);
    params.set('format', 'csv');

    try {
      const res = await fetch(`${API_BASE}/appointments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'appointments.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setAuthMessage(err.message);
    }
  }

  async function updateAppointmentStatus(id, nextStatus) {
    if (!token) {
      setAuthMessage('Please sign in as a provider first.');
      return;
    }

    const apiStatus = {
      Confirmed: 'confirmed',
      Waiting: 'waiting',
      'Checked In': 'checked_in',
      Completed: 'completed',
      Cancelled: 'cancelled'
    }[nextStatus];

    if (!apiStatus) return;

    try {
      const res = await fetch(`${API_BASE}/appointments/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: apiStatus })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to update appointment');

      setAppointments((current) =>
        current.map((appt) => (appt.id === id ? { ...appt, status: normalizeAppointmentStatus(data.status) } : appt))
      );
    } catch (error) {
      setAuthMessage(error.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setToken(data.token);
      localStorage.setItem('token', data.token);
      // role now comes from the server's user record, not a client-side picker
      setRole(data.user.role);
      setAuthMessage(`Signed in as ${data.user.email} (${data.user.role})`);
      if (data.user.role === 'provider') {
        setActiveView('provider');
      }
    } catch (error) {
      setAuthMessage(error.message);
    }
  }

  async function fetchSlots() {
    if (!token) {
      setAuthMessage('Please sign in first.');
      return;
    }
    if (!selectedPatientClinic) {
      setBookingStatus('Please choose a clinic first.');
      return;
    }

    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    try {
      const res = await fetch(
        `${API_BASE}/availability?clinic_id=${encodeURIComponent(selectedPatientClinic)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Unable to load slots');
      setSlots(data);
      setSelectedSlot(null);
    } catch (error) {
      setBookingStatus(error.message);
      setSlots([]);
    }
  }

  async function handleBooking(event) {
    event.preventDefault();

    if (!token) {
      setBookingStatus('Please sign in first.');
      return;
    }
    if (!selectedSlot) {
      setBookingStatus('Please choose a slot first.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/appointments`, {
        method: 'POST',
        ...requestConfig,
        body: JSON.stringify({
          timeslot_id: selectedSlot.id,
          patient: {
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            phone: form.phone
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Booking failed');
      setBookingStatus(`Appointment booked successfully for ${formatSlot(selectedSlot.start_ts)}.`);
      setSelectedSlot(null);
      setSlots([]);
      setForm({ first_name: '', last_name: '', email: '', phone: '' });
    } catch (error) {
      setBookingStatus(error.message);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <p className="eyebrow">Clinic Portal</p>
        <h1>Appointment Scheduling System</h1>
      </header>

      <div className="tab-bar" aria-label="Main navigation">
        <button
          type="button"
          className={`tab-button ${activeView === 'patient' ? 'active' : ''}`}
          onClick={() => setActiveView('patient')}
        >
          Patient booking
        </button>
        <button
          type="button"
          className={`tab-button ${activeView === 'provider' ? 'active' : ''}`}
          onClick={() => setActiveView('provider')}
        >
          Provider dashboard
        </button>
        <button
          type="button"
          className={`tab-button ${activeView === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveView('admin')}
        >
          Admin
        </button>
      </div>
      {activeView === 'patient' && (
        <main className="layout">
          <section className="panel">
            <h2>1. Sign in</h2>
            <form onSubmit={handleLogin} className="stacked-form">
              <label>
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
              </label>
              <label>
                Password
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} />
              </label>
              <button type="submit">Login</button>
              <p className="status muted">
                Don&apos;t have an account? Sign up via <code>POST /auth/signup</code> with
                first name, last name, email, and password (role defaults to patient).
              </p>
            </form>
            <div className="status muted">{authMessage}</div>
          </section>

          <section className="panel">
            <h2>2. Choose clinic</h2>
            <div className="stacked-form">
              <label>
                Clinic
                <select
                  value={selectedPatientClinic}
                  onChange={(e) => setSelectedPatientClinic(e.target.value)}
                >
                  {patientClinics.length === 0 ? (
                    <option value="">No clinics loaded yet</option>
                  ) : (
                    patientClinics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {typeof c.distance_km === 'number' ? ` — ${c.distance_km.toFixed(1)} km away` : ''}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button type="button" onClick={findNearbyClinics}>Find clinics near me</button>
              <div className="status muted">{locateStatus}</div>
            </div>
          </section>

          <section className="panel">
            <h2>3. Choose visit</h2>
            <div className="stacked-form">
              <label>
                Date
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <button type="button" onClick={fetchSlots}>View available slots</button>
            </div>
          </section>

          <section className="panel">
            <h2>4. Select time</h2>
            <div className="slot-list">
              {slots.length === 0 ? (
                <div className="empty">No slots loaded yet.</div>
              ) : (
                slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    className={`slot-button ${selectedSlot?.id === slot.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {formatSlot(slot.start_ts)}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <h2>5. Patient details</h2>
            <form onSubmit={handleBooking} className="stacked-form">
              <label>
                First name
                <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} type="text" required />
              </label>
              <label>
                Last name
                <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} type="text" required />
              </label>
              <label>
                Email
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" required />
              </label>
              <label>
                Phone
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} type="tel" />
              </label>
              <button type="submit">Book appointment</button>
            </form>
            {bookingStatus && <div className="status success">{bookingStatus}</div>}
          </section>
        </main>
      )}

      {activeView === 'provider' && (
        <main className="provider-dashboard">
          <section className="panel dashboard-summary">
            <h2>Today’s schedule</h2>
            <div className="summary-grid">
              <div className="summary-box">
                <span>Total</span>
                <strong>{appointments.length}</strong>
              </div>
              <div className="summary-box">
                <span>Confirmed</span>
                <strong>{appointments.filter((a) => a.status === 'Confirmed').length}</strong>
              </div>
              <div className="summary-box">
                <span>Checked In</span>
                <strong>{appointments.filter((a) => a.status === 'Checked In').length}</strong>
              </div>
            </div>
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                alignItems: 'flex-end'
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600 }}>Start</span>
                <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600 }}>Clinic</span>
                <select value={activeClinic} onChange={(e) => setActiveClinic(e.target.value)}>
                  {clinics.length === 0 ? (
                    <option value="">No linked clinics yet</option>
                  ) : (
                    clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                  )}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600 }}>End</span>
                <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
              </label>
              <button type="button" onClick={onProviderDateRangeChange}>Apply range</button>
            </div>
          </section>

          <section className="panel schedule-panel">
            <h2>Appointments</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setPage(Math.max(1, page - 1)); fetchProviderAppointments(); }}>Prev</button>
                <button type="button" onClick={() => { setPage(page + 1); fetchProviderAppointments(); }}>Next</button>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  Page size
                  <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); fetchProviderAppointments(); }}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
                <button type="button" onClick={exportCsv} style={{ whiteSpace: 'nowrap' }}>Export CSV</button>
              </div>
            </div>

            <div className="appointment-list">
              {Object.entries(appointments.reduce((acc, appt) => {
                const day = (new Date(appt.time)).toISOString().split('T')[0];
                acc[day] = acc[day] || [];
                acc[day].push(appt);
                return acc;
              }, {})).map(([day, items]) => (
                <div key={day} style={{ marginBottom: 12 }}>
                  <h3 style={{ margin: '8px 0' }}>{new Date(day).toLocaleDateString()}</h3>
                  {items.map((appt) => (
                    <div className="appointment-row" key={appt.id}>
                      <div>
                        <strong>{appt.patient}</strong>
                        <p>{formatSlot(appt.time)}</p>
                      </div>
                      <div className="appointment-meta">
                        <span className={`tag ${appt.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {appt.status}
                        </span>
                        <div className="action-row">
                          <button type="button" onClick={() => updateAppointmentStatus(appt.id, 'Checked In')}>
                            Check in
                          </button>
                          <button type="button" onClick={() => updateAppointmentStatus(appt.id, 'Completed')}>
                            Complete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {activeView === 'admin' && (
        <main className="provider-dashboard">
          <AdminAudit apiBase={API_BASE} token={token} />
        </main>
      )}
    </div>
  );
}
