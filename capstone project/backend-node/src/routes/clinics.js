const express = require('express');
const { query, validationResult } = require('express-validator');
const db = require('../db');
const router = express.Router();

// These endpoints are intentionally public (mounted without `authenticate` in
// index.js) — a patient needs to be able to browse/find a clinic before they
// have an account or are signed in.

/**
 * @openapi
 * /clinics:
 *   get:
 *     summary: List all clinics
 *     responses:
 *       200:
 *         description: All clinics
 */
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, timezone, address, phone, latitude, longitude
       FROM clinic
       ORDER BY name ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('failed to list clinics', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

const validateNearby = [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat must be a number between -90 and 90'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be a number between -180 and 180'),
  query('radius_km').optional().isFloat({ min: 0.1, max: 500 }).withMessage('radius_km must be between 0.1 and 500'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50')
];

/**
 * @openapi
 * /clinics/nearby:
 *   get:
 *     summary: Find clinics near a given coordinate
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: radius_km
 *         schema: { type: number, default: 25 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Clinics within range, nearest first
 */
router.get('/nearby', validateNearby, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radiusKm = req.query.radius_km ? parseFloat(req.query.radius_km) : 25;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;

  try {
    // Haversine distance in km. Computed in a subquery so we can filter and
    // sort on the resulting distance_km column. 6371 = Earth's radius in km.
    const sql = `
      SELECT * FROM (
        SELECT
          id, name, timezone, address, phone, latitude, longitude,
          6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2))
              + sin(radians($1)) * sin(radians(latitude))
            ))
          ) AS distance_km
        FROM clinic
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ) nearby
      WHERE distance_km <= $3
      ORDER BY distance_km ASC
      LIMIT $4
    `;
    const { rows } = await db.query(sql, [lat, lng, radiusKm, limit]);
    res.json(rows.map((r) => ({ ...r, distance_km: Number(r.distance_km) })));
  } catch (err) {
    console.error('nearby clinic search failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
