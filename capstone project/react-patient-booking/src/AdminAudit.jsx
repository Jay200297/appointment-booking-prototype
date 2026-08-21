import { useState, useEffect } from 'react';

export default function AdminAudit({ apiBase = 'http://localhost:8000', token = '' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchRows() {
    setLoading(true);
    setError('');
    try {
      const authToken = token || localStorage.getItem('token') || '';
      const res = await fetch(`${apiBase}/admin/audit?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (!res.ok) {
        setRows([]);
        setError(`Unable to load audit log (status ${res.status}).`);
        return;
      }

      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      // Covers network errors and non-JSON responses alike -- without this,
      // a failed/misdirected request leaves `loading` stuck true forever
      // because setLoading(false) below would never run.
      setRows([]);
      setError('Unable to load audit log — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="panel schedule-panel">
      <h2>Audit Log</h2>
      <div className="action-row" style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => window.open(`${apiBase}/admin/audit?format=csv`, '_blank')}>
          Export CSV
        </button>
        <button type="button" onClick={fetchRows} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="status" style={{ color: 'var(--warning, #b45309)', marginBottom: 12 }}>{error}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table className="audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">
                  {loading ? 'Loading audit log…' : 'No audit entries yet.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.user_id}</td>
                  <td>{r.action}</td>
                  <td>{r.resource_type}:{r.resource_id}</td>
                  <td className="metadata-cell">{r.metadata ? JSON.stringify(r.metadata) : ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
