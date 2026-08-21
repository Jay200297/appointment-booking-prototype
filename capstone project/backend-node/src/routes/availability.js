const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * @openapi
 * /availability:
 *   get:
 *     summary: Get available appointment slots
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clinic_id
 *         schema: { type: string }
 *       - in: query
 *         name: provider_id
 *         schema: { type: string }
 *       - in: query
 *         name: start
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: end
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Available timeslots
 */
router.get('/', async (req, res) => {
  try {
    const { clinic_id, provider_id, start, end } = req.query;
    let sql = `SELECT id, clinic_id, provider_id, service_id, start_ts, end_ts FROM timeslot WHERE status = 'available'`;
    const params = [];
    if (clinic_id) {
      params.push(clinic_id);
      sql += ` AND clinic_id = $${params.length}`;
    }
    if (provider_id) {
      params.push(provider_id);
      sql += ` AND provider_id = $${params.length}`;
    }
    if (start) {
      params.push(start);
      sql += ` AND start_ts >= $${params.length}`;
    }
    if (end) {
      params.push(end);
      sql += ` AND end_ts <= $${params.length}`;
    }
    sql += ' ORDER BY start_ts ASC LIMIT 500';

    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
