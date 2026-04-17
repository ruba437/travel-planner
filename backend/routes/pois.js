// backend/routes/pois.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { ok, err } = require('../utils/response');

const optionalAuth = (req, _res, next) => {
  req.userId = null;
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();

  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = Number(decoded?.id) || null;
  } catch (_e) {
    req.userId = null;
  }
  next();
};

router.post('/', async (req, res) => {
  try {
    const { city_id, category, name, description, cover_image, star_rating, book_url, sort_order } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO public.city_pois
         (city_id, category, name, description, cover_image, star_rating, book_url, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [city_id, category, name, description, cover_image, star_rating ?? null, book_url ?? null, sort_order ?? 0]
    );
    ok(res, rows[0]);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to create POI');
  }
});

router.post('/:id/save', optionalAuth, async (req, res) => {
  if (!req.userId) return err(res, 'Unauthorised', 401);
  try {
    const poiId = Number(req.params.id);
    const existing = await pool.query(
      `SELECT id FROM public.user_saved_pois WHERE userid = $1 AND poi_id = $2`,
      [req.userId, poiId]
    );
    if (existing.rows.length) {
      await pool.query(`DELETE FROM public.user_saved_pois WHERE userid = $1 AND poi_id = $2`, [req.userId, poiId]);
      ok(res, { saved: false });
    } else {
      await pool.query(`INSERT INTO public.user_saved_pois (userid, poi_id) VALUES ($1,$2)`, [req.userId, poiId]);
      ok(res, { saved: true });
    }
  } catch (e) {
    console.error(e);
    err(res, 'Failed to toggle save');
  }
});

module.exports = router;