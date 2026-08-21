const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /admin/audit
// Query params: page, limit, start, end, format=csv
router.get('/audit', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const params = [];
    let where = ' WHERE 1=1 ';
    if (req.query.start) {
      params.push(req.query.start);
      where += ` AND created_at >= $${params.length} `;
    }
    if (req.query.end) {
      params.push(req.query.end);
      where += ` AND created_at <= $${params.length} `;
    }

    params.push(limit);
    params.push(offset);

    const sql = `SELECT id, performed_by AS user_id, action, entity_type AS resource_type, entity_id AS resource_id, data AS metadata, created_at FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`;
    const { rows } = await db.query(sql, params);

    if (String(req.query.format || '').toLowerCase() === 'csv') {
      const header = ['id', 'user_id', 'action', 'resource_type', 'resource_id', 'metadata', 'created_at'];

      try {
        const client = await db.getClient();
        let QueryStream;
        try { QueryStream = require('pg-query-stream'); } catch (e) { QueryStream = null; }

        if (QueryStream && client.query && client.release) {
          const qs = new QueryStream(`SELECT id, performed_by AS user_id, action, entity_type AS resource_type, entity_id AS resource_id, data AS metadata, created_at FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
          const stream = client.query(qs);

          res.set('Content-Type', 'text/csv; charset=utf-8');
          res.set('Content-Disposition', 'attachment; filename="audit_log.csv"');
          res.write(header.join(',') + '\n');

          stream.on('data', (r) => {
            const cols = header.map((h) => {
              let v = r[h];
              if (v === null || v === undefined) return '';
              if (typeof v === 'object') v = JSON.stringify(v);
              return '"' + String(v).replace(/"/g, '""') + '"';
            });
            res.write(cols.join(',') + '\n');
          });

          stream.on('end', () => { client.release(); res.end(); });
          stream.on('error', (err) => { client.release(); console.error(err); res.status(500).end(); });
          return;
        }
      } catch (e) {
        console.error('audit csv stream failed, falling back', e);
      }

      // fallback
      const csvHeader = header.join(',');
      const csvRows = [csvHeader];
      for (const r of rows) {
        const cols = header.map((h) => {
          let v = r[h];
          if (v === null || v === undefined) return '';
          if (typeof v === 'object') v = JSON.stringify(v);
          return '"' + String(v).replace(/"/g, '""') + '"';
        });
        csvRows.push(cols.join(','));
      }
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="audit_log.csv"');
      return res.status(200).send(csvRows.join('\n'));
    }

    return res.status(200).json(rows);
  } catch (err) {
    console.error('audit list failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
