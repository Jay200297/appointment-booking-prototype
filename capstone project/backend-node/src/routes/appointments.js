const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { validateAppointment, validateAppointmentQuery, handleValidation } = require('../middleware/validation');
const { requireRole } = require('../middleware/auth');

/**
 * @openapi
 * /appointments:
 *   post:
 *     summary: Book an available appointment slot
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timeslot_id, patient]
 *             properties:
 *               timeslot_id:
 *                 type: string
 *               patient:
 *                 type: object
 *                 properties:
 *                   first_name: { type: string }
 *                   last_name: { type: string }
 *                   email: { type: string }
 *                   phone: { type: string }
 *     responses:
 *       201:
 *         description: Booking created
 */
router.get('/', validateAppointmentQuery, handleValidation, async (req, res) => {
  try {
    let { clinic_id, provider_id, status, start, end } = req.query;

    // Providers must only list their own appointments. If a provider requests
    // a different provider_id, forbid the request. Otherwise force the
    // provider_id filter to the authenticated provider.
    if (req.user && req.user.role === 'provider') {
      if (!req.user.providerId) {
        return res.status(403).json({ error: 'Forbidden: account is not linked to a provider record' });
      }
      if (provider_id && provider_id !== req.user.providerId) {
        return res.status(403).json({ error: 'Forbidden: cannot list other providers appointments' });
      }
      provider_id = req.user.providerId;
      // If provider supplied a clinic_id, ensure the provider belongs to that clinic
      if (clinic_id) {
        try {
          const cp = await db.query('SELECT 1 FROM clinic_provider WHERE clinic_id = $1 AND provider_id = $2 LIMIT 1', [clinic_id, req.user.providerId]);
          if (!cp || cp.rowCount === 0) {
            return res.status(403).json({ error: 'Forbidden: provider not associated with clinic' });
          }
        } catch (e) {
          console.error('clinic membership check failed', e);
          return res.status(500).json({ error: 'internal_error' });
        }
      }
    }
    let sql = `
      SELECT
        a.id,
        a.clinic_id,
        a.provider_id,
        a.service_id,
        a.status,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        p.email AS patient_email,
        p.phone AS patient_phone,
        t.start_ts,
        t.end_ts
      FROM appointment a
      LEFT JOIN patient p ON p.id = a.patient_id
      LEFT JOIN timeslot t ON t.id = a.slot_id
      WHERE 1 = 1`;

    const params = [];
    const { service_id, page, limit, format } = req.query || {};
    if (clinic_id) {
      params.push(clinic_id);
      sql += ` AND a.clinic_id = $${params.length}`;
    }
    if (provider_id) {
      params.push(provider_id);
      sql += ` AND a.provider_id = $${params.length}`;
    }
    if (service_id) {
      params.push(service_id);
      sql += ` AND a.service_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND a.status = $${params.length}`;
    }
    if (start) {
      params.push(start);
      sql += ` AND t.start_ts >= $${params.length}`;
    }
    if (end) {
      params.push(end);
      sql += ` AND t.end_ts <= $${params.length}`;
    }

    sql += ' ORDER BY t.start_ts ASC';

    // pagination
    const pageNum = Math.max(parseInt(page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(limit || '100', 10), 1), 1000);
    const offset = (pageNum - 1) * pageSize;
    params.push(pageSize);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const { rows } = await db.query(sql, params);

    if (String(format || '').toLowerCase() === 'csv') {
      const header = ['id','clinic_id','provider_id','service_id','status','patient_first_name','patient_last_name','patient_email','start_ts','end_ts'];

      // Try streaming via pg-query-stream when available. Fall back to in-memory CSV.
      try {
        const client = await db.getClient();
        let QueryStream;
        try {
          QueryStream = require('pg-query-stream');
        } catch (e) {
          QueryStream = null;
        }

        if (QueryStream && client.query && client.release) {
          const qs = new QueryStream(sql, params);
          const stream = client.query(qs);

          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', 'attachment; filename="appointments.csv"');

          // write header
          res.write(header.join(',') + '\n');

          stream.on('data', (r) => {
            const vals = header.map((h) => {
              let v = r[h];
              if (v === null || v === undefined) v = '';
              if (typeof v === 'object') v = JSON.stringify(v);
              return '"' + String(v).replace(/"/g, '""') + '"';
            });
            res.write(vals.join(',') + '\n');
          });

          stream.on('end', () => {
            client.release();
            res.end();
          });

          stream.on('error', (err) => {
            client.release();
            console.error('stream error', err);
            res.status(500).end();
          });

          return;
        }
      } catch (e) {
        console.error('csv stream setup failed, falling back', e);
      }

      // Fallback: run full query and build CSV in memory
      try {
        const { rows: fullRows } = await db.query(sql, params);
        const lines = [header.join(',')];
        for (const r of fullRows) {
          const vals = header.map((h) => {
            let v = r[h] == null ? '' : r[h];
            if (typeof v === 'object') v = JSON.stringify(v);
            return '"' + String(v).replace(/"/g, '""') + '"';
          });
          lines.push(vals.join(','));
        }
        const csv = lines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="appointments.csv"');
        return res.send(csv);
      } catch (e) {
        console.error('csv fallback failed', e);
        return res.status(500).json({ error: 'Internal error' });
      }
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.patch('/:id/status', requireRole('provider', 'admin'), handleValidation, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  const allowedStatuses = ['confirmed', 'waiting', 'checked_in', 'completed', 'cancelled'];
  if (!status || !allowedStatuses.includes(String(status).toLowerCase())) {
    return res.status(400).json({ error: 'status must be one of confirmed, waiting, checked_in, completed, cancelled' });
  }

  try {
    const existing = await db.query('SELECT id, status, provider_id FROM appointment WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // provider can only modify their own appointments
    if (req.user && req.user.role === 'provider') {
      const owner = existing.rows[0].provider_id;
      if (owner && owner !== req.user.providerId) {
        return res.status(403).json({ error: 'Forbidden: cannot modify another provider\'s appointment' });
      }
    }

    const normalizedStatus = String(status).toLowerCase();
    const update = await db.query(
      'UPDATE appointment SET status = $1, updated_at = now() WHERE id = $2',
      [normalizedStatus, id]
    );

    if (update.rowCount === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // insert audit log
    try {
      const auditId = uuidv4();
      const details = JSON.stringify({ from: existing.rows[0].status, to: normalizedStatus });
      await db.query(
        'INSERT INTO audit_log(id, entity_type, entity_id, action, performed_by, data, created_at) VALUES ($1,$2,$3,$4,$5,$6,now())',
        [auditId, 'appointment', id, 'status_update', req.user?.id || null, details]
      );
    } catch (e) {
      console.error('Failed to write audit log', e);
    }

    return res.json({ id, status: normalizedStatus });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/', validateAppointment, handleValidation, async (req, res) => {
  const { timeslot_id, patient } = req.body;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const tsRes = await client.query('SELECT * FROM timeslot WHERE id = $1 FOR UPDATE', [timeslot_id]);
    if (tsRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Timeslot not found' });
    }
    const ts = tsRes.rows[0];
    if (ts.status !== 'available') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Timeslot not available' });
    }

    let patientId = null;
    if (patient.email) {
      const pRes = await client.query('SELECT id FROM patient WHERE email = $1 AND clinic_id = $2 LIMIT 1', [patient.email, ts.clinic_id]);
      if (pRes.rowCount > 0) patientId = pRes.rows[0].id;
    }
    if (!patientId) {
      patientId = uuidv4();
      await client.query(
        'INSERT INTO patient(id, clinic_id, first_name, last_name, email, phone) VALUES ($1,$2,$3,$4,$5,$6)',
        [patientId, ts.clinic_id, patient.first_name, patient.last_name, patient.email || null, patient.phone || null]
      );
    }

    await client.query('UPDATE timeslot SET status = $1, updated_at = now() WHERE id = $2', ['booked', timeslot_id]);

    const apptId = uuidv4();
    await client.query(
      'INSERT INTO appointment(id, slot_id, clinic_id, provider_id, service_id, patient_id, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())',
      [apptId, timeslot_id, ts.clinic_id, ts.provider_id, ts.service_id, patientId, 'confirmed']
    );

    await client.query('COMMIT');
    res.status(201).json({ id: apptId, slot_id: timeslot_id, status: 'confirmed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

module.exports = router;
