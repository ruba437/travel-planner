// backend/routes/favorites.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { ok, err } = require('../utils/response');

/**
 * POST /api/favorites/toggle
 * Toggle favorite status for an item (attraction, poi, or itinerary)
 * 
 * Body:
 *   - item_id (required): string identifier of the item
 *   - item_type (required): 'attraction' | 'poi' | 'itinerary'
 *   - metadata (optional): {name, image_url, address, lat, lng} for POIs
 * 
 * Response: {saved: boolean, item_id: string, item_type: string}
 */
router.post('/toggle', authMiddleware, async (req, res) => {
  try {
    const { item_id, item_type, metadata } = req.body;
    const userId = Number(req.user?.id);

    // Validation
    if (!item_id || typeof item_id !== 'string') {
      return err(res, 'item_id is required and must be a string', 400);
    }
    if (!item_type || !['attraction', 'poi', 'itinerary'].includes(item_type)) {
      return err(res, "item_type must be one of: 'attraction', 'poi', 'itinerary'", 400);
    }
    // Note: metadata is optional for all types
    // For 'poi' type, metadata will be used if provided, otherwise details come from city_pois table via JOIN

    // Check if favorite already exists
    const existing = await pool.query(
      `SELECT id FROM user_favorites WHERE userid = $1 AND item_id = $2 AND item_type = $3`,
      [userId, item_id, item_type]
    );

    if (existing.rows.length > 0) {
      // Already favorited, so delete it
      await pool.query(
        `DELETE FROM user_favorites WHERE userid = $1 AND item_id = $2 AND item_type = $3`,
        [userId, item_id, item_type]
      );
      ok(res, { saved: false, item_id, item_type });
    } else {
      // Not favorited yet, so insert it
      await pool.query(
        `INSERT INTO user_favorites (userid, item_id, item_type, metadata)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (userid, item_id, item_type) DO NOTHING`,
        [userId, item_id, item_type, metadata ? JSON.stringify(metadata) : null]
      );
      ok(res, { saved: true, item_id, item_type });
    }
  } catch (e) {
    console.error('Toggle favorite error:', e);
    err(res, 'Failed to toggle favorite', 500);
  }
});

/**
 * GET /api/favorites
 * Fetch all favorites for the authenticated user
 * 
 * Response: Array of {
 *   id, userid, item_id, item_type, name, image_url, address, lat, lng, created_at
 * }
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user?.id);

    // Fetch all favorites for the user with details from related tables
    const { rows } = await pool.query(
      `
      SELECT
        uf.id,
        uf.userid,
        uf.item_id,
        uf.item_type,
        COALESCE(uf.metadata->>'name', cp.name, i.title) AS name,
        COALESCE(uf.metadata->>'image_url', cp.cover_image) AS image_url,
        COALESCE(uf.metadata->>'address', cp.description) AS address,
        COALESCE(cp.latitude::text, uf.metadata->>'lat') AS lat,
        COALESCE(cp.longitude::text, uf.metadata->>'lng') AS lng,
        uf.created_at
      FROM user_favorites uf
      LEFT JOIN public.city_pois cp ON uf.item_type = 'poi' AND uf.item_id = cp.id::text
      LEFT JOIN public.itineraries i ON uf.item_type = 'itinerary' AND uf.item_id = i.id::text
      WHERE uf.userid = $1
      ORDER BY uf.created_at DESC
      `,
      [userId]
    );

    ok(res, rows);
  } catch (e) {
    console.error('Fetch favorites error:', e);
    err(res, 'Failed to fetch favorites', 500);
  }
});

/**
 * GET /api/favorites/check
 * Check if an item is favorited by the user
 * 
 * Query params:
 *   - item_id (required): string
 *   - item_type (required): 'attraction' | 'poi' | 'itinerary'
 * 
 * Response: {saved: boolean, item_id: string, item_type: string}
 */
router.get('/check', authMiddleware, async (req, res) => {
  try {
    const { item_id, item_type } = req.query;
    const userId = Number(req.user?.id);

    // Validation
    if (!item_id || typeof item_id !== 'string') {
      return err(res, 'item_id query parameter is required', 400);
    }
    if (!item_type || !['attraction', 'poi', 'itinerary'].includes(item_type)) {
      return err(res, "item_type must be one of: 'attraction', 'poi', 'itinerary'", 400);
    }

    const result = await pool.query(
      `SELECT id FROM user_favorites WHERE userid = $1 AND item_id = $2 AND item_type = $3`,
      [userId, item_id, item_type]
    );

    ok(res, { saved: result.rows.length > 0, item_id, item_type });
  } catch (e) {
    console.error('Check favorite error:', e);
    err(res, 'Failed to check favorite', 500);
  }
});

module.exports = router;
