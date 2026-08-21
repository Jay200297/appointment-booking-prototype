const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /integrations/ical?clinic_id=...&start=...&end=...
router.get('/ical', async (req, res) => {
  try {
    const { clinic_id, start, end } = req.query;
    let sql = `
      SELECT a.id, a.status, p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.email AS patient_email, t.start_ts, t.end_ts
      FROM appointment a
      LEFT JOIN patient p ON p.id = a.patient_id
      LEFT JOIN timeslot t ON t.id = a.slot_id
      WHERE 1 = 1`;

    const params = [];
    if (clinic_id) {
      params.push(clinic_id);
      sql += ` AND a.clinic_id = $${params.length}`;
    }
    if (start) {
      params.push(start);
      sql += ` AND t.start_ts >= $${params.length}`;
    }
    if (end) {
      params.push(end);
      sql += ` AND t.end_ts <= $${params.length}`;
    }

    sql += ' ORDER BY t.start_ts ASC LIMIT 1000';
    const { rows } = await db.query(sql, params);

    // Build iCalendar
    const lines = [];
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//Clinic Scheduler//EN');

    for (const r of rows) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${r.id}`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      const start = new Date(r.start_ts).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const end = new Date(r.end_ts).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
      lines.push(`SUMMARY:Appointment - ${r.patient_first_name || ''} ${r.patient_last_name || ''}`);
      if (r.patient_email) lines.push(`ATTENDEE:MAILTO:${r.patient_email}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    const ical = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.send(ical);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
