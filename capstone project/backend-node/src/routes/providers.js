const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /providers/me/clinics - returns clinics the authenticated provider belongs to
router.get('/me/clinics', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'provider') return res.status(403).json({ error: 'Forbidden' });

    if (!req.user.providerId) {
      // This account has the 'provider' role but isn't linked to a clinical
      // staff record yet (e.g. self-signup awaiting admin linking).
      return res.json([]);
    }

    const sql = `
      SELECT c.id, c.name, c.address
      FROM clinic c
      JOIN clinic_provider cp ON cp.clinic_id = c.id
      WHERE cp.provider_id = $1
      ORDER BY c.name
    `;
    const { rows } = await db.query(sql, [req.user.providerId]);
    res.json(rows);
  } catch (err) {
    console.error('failed to load provider clinics', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
