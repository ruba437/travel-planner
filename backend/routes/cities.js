// backend/routes/cities.js
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
  } catch (_e) { req.userId = null; }
  next();
};

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, city, country, description, cover_image, latitude, longitude
       FROM public.cities
       WHERE is_active = true
       ORDER BY city ASC`
    );
    ok(res, rows); // ⚠️ 確保 cities.js 頂部有 const { ok, err } = require('../utils/response');
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch cities');
  }
});

router.get('/:city', optionalAuth, async (req, res) => {
  try {
    const { city } = req.params;
    const { rows } = await pool.query(
      `SELECT id, city, country, description, cover_image, latitude, longitude
       FROM public.cities
       WHERE lower(city) = lower($1) AND is_active = true
       LIMIT 1`,
      [city]
    );
    if (!rows.length) return err(res, 'City not found', 404);
    ok(res, rows[0]);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch city');
  }
});

router.post('/', async (req, res) => {
  try {
    const { city, country, description, cover_image, latitude, longitude } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO public.cities (city, country, description, cover_image, latitude, longitude)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [city, country, description, cover_image, latitude, longitude]
    );
    ok(res, rows[0]);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to create city');
  }
});

router.get('/:city/pois', optionalAuth, async (req, res) => {
  try {
    const { city } = req.params;
    const { category, limit = 20 } = req.query;

    const cityRow = await pool.query(
      `SELECT id FROM public.cities WHERE lower(city) = lower($1) AND is_active = true LIMIT 1`,
      [city]
    );
    if (!cityRow.rows.length) return err(res, 'City not found', 404);
    const cityId = cityRow.rows[0].id;

    const params = [cityId];
    let catClause = '';
    if (category) {
      params.push(category);
      catClause = `AND p.category = $${params.length}`;
    }

    const savedJoin = req.userId
      ? `LEFT JOIN public.user_saved_pois sp ON sp.poi_id = p.id AND sp.userid = ${Number(req.userId)}`
      : '';
    const savedCol = req.userId ? ', (sp.id IS NOT NULL) AS is_saved' : ', false AS is_saved';

    const { rows } = await pool.query(
      `SELECT p.id, p.category, p.name, p.description, p.cover_image,
              p.star_rating, p.book_url, p.sort_order
              ${savedCol}
       FROM   public.city_pois p
       ${savedJoin}
       WHERE  p.city_id = $1 ${catClause} AND p.is_active = true
       ORDER  BY p.sort_order ASC, p.id ASC
       LIMIT  $${params.length + 1}`,
      [...params, Number(limit)]
    );
    ok(res, rows);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch POIs');
  }
});

router.get('/:city/guide', optionalAuth, async (req, res) => {
  try {
    const { city } = req.params;

    const cityRow = await pool.query(
      `SELECT * FROM public.cities WHERE lower(city) = lower($1) AND is_active = true LIMIT 1`,
      [city]
    );
    if (!cityRow.rows.length) return err(res, 'City not found', 404);
    const cityData = cityRow.rows[0];

    const savedJoin = req.userId
      ? `LEFT JOIN public.user_saved_pois sp ON sp.poi_id = p.id AND sp.userid = ${Number(req.userId)}`
      : '';
    const savedCol = req.userId ? ', (sp.id IS NOT NULL) AS is_saved' : ', false AS is_saved';

    const { rows: pois } = await pool.query(
      `SELECT p.id, p.category, p.name, p.description, p.cover_image,
              p.star_rating, p.book_url, p.sort_order ${savedCol}
       FROM   public.city_pois p ${savedJoin}
       WHERE  p.city_id = $1 AND p.is_active = true
       ORDER  BY p.sort_order ASC`,
      [cityData.id]
    );

    const grouped = pois.reduce((acc, poi) => {
      acc[poi.category] = acc[poi.category] || [];
      acc[poi.category].push(poi);
      return acc;
    }, {});

    ok(res, {
      city: cityData,
      places: grouped.place || [],
      hotels: grouped.hotel || [],
      restaurants: grouped.restaurant || [],
      activities: grouped.activity || [],
      transport: grouped.transport || [],
    });
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch city guide');
  }
});

module.exports = router;