const db = require('../db');
const { sendSms } = require('./notifications');

async function runReminders(minutes = 60) {
  const now = new Date();
  const end = new Date(now.getTime() + minutes * 60000);

  const sql = `
    SELECT a.id, p.phone, p.first_name, p.last_name, t.start_ts
    FROM appointment a
    LEFT JOIN patient p ON p.id = a.patient_id
    LEFT JOIN timeslot t ON t.id = a.slot_id
    WHERE a.status IN ('confirmed') AND t.start_ts >= $1 AND t.start_ts <= $2
    LIMIT 200`;

  const { rows } = await db.query(sql, [now.toISOString(), end.toISOString()]);
  const results = [];
  for (const r of rows) {
    if (!r.phone) continue;
    const msg = `Reminder: you have an appointment on ${new Date(r.start_ts).toLocaleString()}`;
    const res = await sendSms({ appointment_id: r.id, to: r.phone, message: msg });
    results.push(res);
  }
  return results;
}

module.exports = { runReminders };
