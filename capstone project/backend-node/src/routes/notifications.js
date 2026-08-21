const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendSms } = require('../services/notifications');

// Shape a raw notification row (channel/payload) into the flatter shape the
// frontend expects (recipient/message), without changing what's stored.
function shapeNotification(row) {
  const payload = row.payload || {};
  return {
    id: row.id,
    appointment_id: row.appointment_id,
    clinic_id: row.clinic_id,
    channel: row.channel,
    recipient: payload.to || null,
    message: payload.message || null,
    status: row.status,
    read_at: row.read_at,
    created_at: row.created_at
  };
}

// POST /notifications/sms
router.post('/sms', async (req, res) => {
  const { appointment_id, to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ error: 'to and message required' });

  try {
    const result = await sendSms({ appointment_id, to, message, user_id: req.user?.id });
    if (result.status === 'sent') return res.json({ id: result.id, status: 'sent' });
    return res.status(500).json({ error: 'failed to send' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /notifications - list recent notifications
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(200, Number(req.query.limit || 100));

    // If patient role, attempt to find matching patient by email and filter notifications
    if (req.user && req.user.role === 'patient') {
      const { rows: pRows } = await db.query('SELECT id, phone FROM patient WHERE email = $1 LIMIT 1', [req.user.email]);
      if (pRows && pRows.length > 0) {
        const patient = pRows[0];
        const sql = `
          SELECT id, appointment_id, clinic_id, channel, status, payload, read_at, created_at
          FROM notification
          WHERE (payload->>'to') = $1 OR appointment_id IN (SELECT id FROM appointment WHERE patient_id = $2)
          ORDER BY created_at DESC LIMIT $3`;
        const { rows } = await db.query(sql, [patient.phone, patient.id, limit]);
        return res.json(rows.map(shapeNotification));
      }
      return res.json([]);
    }

    // Admins and providers may pass ?recipient=... to filter, otherwise return recent
    if (req.query.recipient) {
      const sql = `
        SELECT id, appointment_id, clinic_id, channel, status, payload, read_at, created_at
        FROM notification WHERE (payload->>'to') = $1 ORDER BY created_at DESC LIMIT $2`;
      const { rows } = await db.query(sql, [req.query.recipient, limit]);
      return res.json(rows.map(shapeNotification));
    }

    const { rows } = await db.query(
      `SELECT id, appointment_id, clinic_id, channel, status, payload, read_at, created_at
       FROM notification ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.json(rows.map(shapeNotification));
  } catch (err) {
    console.error('failed to list notifications', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// GET /notifications/count - unread count for current user
router.get('/count', async (req, res) => {
  try {
    if (req.user && req.user.role === 'patient') {
      const { rows: pRows } = await db.query('SELECT id, phone FROM patient WHERE email = $1 LIMIT 1', [req.user.email]);
      if (pRows && pRows.length > 0) {
        const patient = pRows[0];
        const sql = `
          SELECT COUNT(*)::int as cnt FROM notification
          WHERE ((payload->>'to') = $1 OR appointment_id IN (SELECT id FROM appointment WHERE patient_id = $2))
            AND read_at IS NULL`;
        const { rows } = await db.query(sql, [patient.phone, patient.id]);
        return res.json({ count: rows[0].cnt || 0 });
      }
      return res.json({ count: 0 });
    }

    if (req.query.recipient) {
      const { rows } = await db.query(
        "SELECT COUNT(*)::int as cnt FROM notification WHERE (payload->>'to') = $1 AND read_at IS NULL",
        [req.query.recipient]
      );
      return res.json({ count: rows[0].cnt || 0 });
    }

    const { rows } = await db.query("SELECT COUNT(*)::int as cnt FROM notification WHERE read_at IS NULL");
    return res.json({ count: rows[0].cnt || 0 });
  } catch (err) {
    console.error('failed to count notifications', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// POST /notifications/:id/read - mark a notification as read
router.post('/:id/read', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'missing id' });
  try {
    // read_at is separate from `status`, which reflects delivery outcome
    // (queued/sent/failed), not whether the recipient has seen it.
    const { rowCount } = await db.query('UPDATE notification SET read_at = now() WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Notification not found' });
    return res.json({ id, read: true });
  } catch (err) {
    console.error('failed to mark read', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// POST /notifications/test - send a test notification to the logged-in patient's phone
router.post('/test', async (req, res) => {
  try {
    const { rows: pRows } = await db.query('SELECT id, phone FROM patient WHERE email = $1 LIMIT 1', [req.user?.email]);
    const to = req.body.to || (pRows && pRows[0] && pRows[0].phone);
    if (!to) return res.status(400).json({ error: 'No recipient phone available' });
    const msg = req.body.message || `Test notification for ${req.user?.email || 'you'}`;
    const sent = await sendSms({ appointment_id: null, to, message: msg, user_id: req.user?.id });
    if (sent && sent.status === 'sent') return res.json({ status: 'sent', id: sent.id });
    return res.status(500).json({ error: 'failed to send' });
  } catch (err) {
    console.error('failed to send test', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// POST /notifications/run-reminders
router.post('/run-reminders', async (req, res) => {
  const minutes = Number(req.body.minutes || 60);
  try {
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
      // eslint-disable-next-line no-await-in-loop
      const sent = await sendSms({ appointment_id: r.id, to: r.phone, message: msg, user_id: req.user?.id });
      results.push(sent);
    }
    return res.json({ sent: results.length, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
