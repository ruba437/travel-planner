// backend/routes/trending.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ok, err } = require('../utils/response');

// GET /api/trending — top destinations
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const { rows } = await pool.query(
      `SELECT id, city, country, score, cover_image
       FROM   public.cities
       WHERE  is_active = true
       ORDER  BY score DESC NULLS LAST, updatedat DESC
       LIMIT  $1`,
      [limit]
    );
    ok(res, rows);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch trending destinations');
  }
});

module.exports = router;