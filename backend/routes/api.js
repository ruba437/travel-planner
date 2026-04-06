// backend/routes/api.js
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// 所有 API 啟動前查看auth是否通過
const authMiddleware = require('../middleware/auth');

// 照片不需要 auth（<img> 無法帶 header）
router.get('/places/photo', async (req, res) => {
  const { ref, maxwidth } = req.query;
  if (!ref) return res.status(400).send('Missing ref');
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/photo', {
      params: { photo_reference: ref, maxwidth: maxwidth || 400, key: process.env.GOOGLE_PLACES_API_KEY },
      responseType: 'arraybuffer',
    });
    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);
  } catch (err) { res.status(500).send('Failed'); }
});


/// need check 
// ─── helpers ────────────────────────────────────────────────
const ok = (res, data) => res.json({ success: true, data });
const err = (res, msg, code = 500) => res.status(code).json({ success: false, message: msg });

// ─── middleware: optional auth ───────────────────────────────
// Attach req.userId if a valid Bearer JWT exists; otherwise keep null.
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

// ════════════════════════════════════════════════════════════
//  CITIES
// ════════════════════════════════════════════════════════════

// GET /api/cities            — list all active cities
router.get('/cities', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, city, country, description, cover_image, latitude, longitude
       FROM public.cities
       WHERE is_active = true
       ORDER BY city ASC`
    );
    ok(res, rows);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch cities');
  }
});

// GET /api/cities/:city      — single city details
router.get('/cities/:city', optionalAuth, async (req, res) => {
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

// POST /api/cities           — create a city  (admin)
router.post('/cities', async (req, res) => {
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

// ════════════════════════════════════════════════════════════
//  CITY POIs  (places / hotels / restaurants / activities / transport)
// ════════════════════════════════════════════════════════════

// GET /api/cities/:city/pois?category=hotel&limit=10
router.get('/cities/:city/pois', optionalAuth, async (req, res) => {
  try {
    const { city } = req.params;
    const { category, limit = 20 } = req.query;

    // resolve city → id
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

    // if user is logged in, LEFT JOIN to get saved status
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

// GET /api/cities/:city/guide  — full city guide (all categories in one call)
router.get('/cities/:city/guide', optionalAuth, async (req, res) => {
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

    // group by category
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

// POST /api/pois             — add a POI (admin)
router.post('/pois', async (req, res) => {
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

// ════════════════════════════════════════════════════════════
//  SAVED / FAVOURITES  (heart button)
// ════════════════════════════════════════════════════════════

// POST /api/pois/:id/save   — toggle save
router.post('/pois/:id/save', optionalAuth, async (req, res) => {
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

// GET /api/users/:userId/saved  — list user's saved POIs
router.get('/users/:userId/saved', optionalAuth, async (req, res) => {
  if (!req.userId || req.userId !== Number(req.params.userId)) return err(res, 'Unauthorised', 401);
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.category, p.name, p.cover_image, p.book_url, c.city, c.country
       FROM   public.user_saved_pois sp
       JOIN   public.city_pois p  ON p.id = sp.poi_id
       JOIN   public.cities    c  ON c.id = p.city_id
       WHERE  sp.userid = $1
       ORDER  BY sp.savedat DESC`,
      [req.userId]
    );
    ok(res, rows);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch saved items');
  }
});

// ════════════════════════════════════════════════════════════
//  PUBLIC GUIDES  (backed by public itineraries)
// ════════════════════════════════════════════════════════════

function safeParseItineraryData(rawValue) {
  if (!rawValue) return null;
  if (typeof rawValue === 'object') return rawValue;
  try {
    return JSON.parse(rawValue);
  } catch (_e) {
    return null;
  }
}

function toGuideTripInfo(itineraryData) {
  const days = Array.isArray(itineraryData?.days) ? itineraryData.days : [];
  const dayCount = days.length || null;
  return {
    days: dayCount,
    nights: dayCount ? Math.max(dayCount - 1, 0) : null,
  };
}

function buildGuideBody(row, itineraryData) {
  const lines = [];
  const summary = String(row.summary || '').trim();
  const note = String(row.note || '').trim();

  if (summary) lines.push(summary);
  if (note && note !== summary) lines.push(note);

  const days = Array.isArray(itineraryData?.days) ? itineraryData.days : [];
  days.forEach((day, index) => {
    const dayNumber = Number(day?.day) || index + 1;
    const title = String(day?.title || `第 ${dayNumber} 天`).trim();
    lines.push(`${title}`);

    const items = Array.isArray(day?.items) ? day.items : [];
    items.forEach((item) => {
      const time = String(item?.time || '').trim();
      const name = String(item?.name || '').trim() || '未命名項目';
      const itemNote = String(item?.note || '').trim();
      lines.push(`- ${[time, name].filter(Boolean).join(' ')}${itemNote ? `：${itemNote}` : ''}`);
    });
  });

  return lines.join('\n');
}

function mapGuideListRow(row) {
  const itineraryData = safeParseItineraryData(row.itinerarydata);

  return {
    id: `guide-${row.uuid}`,
    slug: row.uuid,
    title: row.title || row.summary || '未命名指南',
    summary: row.summary || '',
    city: row.city || '',
    authorName: row.displayname || row.email || '匿名旅人',
    authorUsername: row.username || null,
    coverImage: row.cover_image || '',
    publishedAt: toISODate(row.updatedat || row.createdat || row.startdate),
    guideCode: null,
    tripInfo: toGuideTripInfo(itineraryData),
  };
}

function mapGuideDetailRow(row) {
  const itineraryData = safeParseItineraryData(row.itinerarydata);

  return {
    id: `guide-${row.uuid}`,
    slug: row.uuid,
    guideCode: null,
    city: row.city || '',
    country: '',
    title: row.title || row.summary || '未命名指南',
    summary: row.summary || '',
    body: buildGuideBody(row, itineraryData),
    coverImage: '',
    tags: Array.isArray(itineraryData?.tags) ? itineraryData.tags : [],
    tripInfo: toGuideTripInfo(itineraryData),
    author: {
      displayName: row.displayname || row.email || '匿名旅人',
      username: row.username || null,
      avatar: row.profilephoto || '',
    },
    publishedAt: toISODate(row.updatedat || row.createdat || row.startdate),
    viewCount: 0,
  };
}

async function fetchPublicGuideRows(limit, { city = '', keyword = '' } = {}) {
  const params = [];
  let sql = `SELECT i.uuid, i.title, i.summary, i.city, i.startdate, i.note, i.itinerarydata,
                    i.createdat, i.updatedat,
                    u.displayname, u.email, u.username, u.profilephoto
             FROM itineraries i
             JOIN users u ON u.id = i.userid
             WHERE i.ispublic = true`;

  if (city) {
    params.push(`%${city}%`);
    sql += ` AND i.city ILIKE $${params.length}`;
  }

  if (keyword) {
    params.push(`%${keyword}%`);
    sql += ` AND (i.title ILIKE $${params.length} OR i.summary ILIKE $${params.length})`;
  }

  params.push(limit);
  sql += ` ORDER BY i.updatedat DESC, i.createdat DESC LIMIT $${params.length}`;

  const { rows } = await pool.query(sql, params);
  return rows;
}

async function getPublicGuideBySlug(slugFromPath) {
  const decoded = (() => {
    try {
      return decodeURIComponent(slugFromPath);
    } catch (_e) {
      return slugFromPath;
    }
  })();

  const { rows } = await pool.query(
    `SELECT i.uuid, i.title, i.summary, i.city, i.startdate, i.note, i.itinerarydata,
            i.createdat, i.updatedat,
            u.displayname, u.email, u.username, u.profilephoto
     FROM itineraries i
     JOIN users u ON u.id = i.userid
     WHERE i.ispublic = true AND i.uuid = $1
     LIMIT 1`,
    [decoded]
  );

  if (rows.length > 0) return mapGuideDetailRow(rows[0]);

  const fallbackRows = await fetchPublicGuideRows(200);
  const normalizedTarget = String(decoded || '').trim().toLowerCase();
  const matchRow = fallbackRows.find((row) => String(row.uuid).toLowerCase() === normalizedTarget || String(row.title || '').trim().toLowerCase() === normalizedTarget);
  return matchRow ? mapGuideDetailRow(matchRow) : null;
}

// GET /api/guides?city=Tokyo&limit=10
router.get('/guides', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 48);
    const city = String(req.query.city || '').trim();
    const keyword = String(req.query.q || '').trim();
    const rows = await fetchPublicGuideRows(limit, { city, keyword });
    const guides = rows.length > 0 ? rows.map(mapGuideListRow) : fallbackGuides.slice(0, limit);
    ok(res, guides);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch guides');
  }
});

// GET /api/guides/:slug
router.get('/guides/:slug', async (req, res) => {
  try {
    const guide = await getPublicGuideBySlug(req.params.slug);
    if (!guide) return err(res, 'Guide not found', 404);
    ok(res, guide);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch guide');
  }
});

//////////// need edit 
function toISODate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function toHHmm(value) {
  if (!value && value !== 0) return null;
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      }
    }
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const CHECKLIST_LIMIT = 10;
const CHECKLIST_TEXT_MAX_LENGTH = 240;

function normalizeChecklistItem(rawItem, fallbackSortOrder = 0) {
  const text = String(rawItem?.text || '').trim().slice(0, CHECKLIST_TEXT_MAX_LENGTH);
  if (!text) return null;

  const sortOrderValue = Number(rawItem?.sortOrder);
  const sortOrder = Number.isFinite(sortOrderValue) ? Math.max(0, sortOrderValue) : fallbackSortOrder;

  return {
    id: Number.isFinite(Number(rawItem?.id)) ? Number(rawItem.id) : null,
    text,
    checked: Boolean(rawItem?.checked),
    reminder: Boolean(rawItem?.reminder),
    sortOrder,
  };
}

function normalizeChecklistItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item, idx) => normalizeChecklistItem(item, idx))
    .filter(Boolean)
    .slice(0, CHECKLIST_LIMIT);
}

async function readChecklistItemsByUuid(clientOrPool, uuid) {
  try {
    const { rows } = await clientOrPool.query(
      `SELECT id, item_text, is_checked, is_reminder, sort_order
       FROM itinerary_checklist_items
       WHERE itinerary_uuid = $1
       ORDER BY sort_order ASC, id ASC`,
      [uuid]
    );
    return rows.map((row) => ({
      id: row.id,
      text: row.item_text,
      checked: Boolean(row.is_checked),
      reminder: Boolean(row.is_reminder),
      sortOrder: Number(row.sort_order) || 0,
    }));
  } catch (e) {
    if (e.code === '42703') {
      const { rows } = await clientOrPool.query(
        `SELECT id, item_text, is_checked, sort_order
         FROM itinerary_checklist_items
         WHERE itinerary_uuid = $1
         ORDER BY sort_order ASC, id ASC`,
        [uuid]
      );
      return rows.map((row) => ({
        id: row.id,
        text: row.item_text,
        checked: Boolean(row.is_checked),
        reminder: false,
        sortOrder: Number(row.sort_order) || 0,
      }));
    }
    if (e.code === '42P01') return null;
    throw e;
  }
}

async function replaceChecklistItems(client, uuid, rawItems) {
  const items = normalizeChecklistItems(rawItems);
  try {
    await client.query('DELETE FROM itinerary_checklist_items WHERE itinerary_uuid = $1', [uuid]);
    if (!items.length) return;

    const values = [];
    const placeholders = items.map((item, idx) => {
      const base = idx * 5;
      values.push(uuid, item.text, item.checked, item.reminder, item.sortOrder);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });
    await client.query(
      `INSERT INTO itinerary_checklist_items (itinerary_uuid, item_text, is_checked, is_reminder, sort_order)
       VALUES ${placeholders.join(', ')}`,
      values
    );
  } catch (e) {
    if (e.code === '42703') {
      await client.query('DELETE FROM itinerary_checklist_items WHERE itinerary_uuid = $1', [uuid]);
      if (!items.length) return;

      const values = [];
      const placeholders = items.map((item, idx) => {
        const base = idx * 4;
        values.push(uuid, item.text, item.checked, item.sortOrder);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      });
      await client.query(
        `INSERT INTO itinerary_checklist_items (itinerary_uuid, item_text, is_checked, sort_order)
         VALUES ${placeholders.join(', ')}`,
        values
      );
      return;
    }
    if (e.code === '42P01') return;
    throw e;
  }
}

async function itineraryBelongsToUser(clientOrPool, uuid, userId) {
  const { rows } = await clientOrPool.query(
    'SELECT 1 FROM itineraries WHERE uuid = $1 AND userid = $2 LIMIT 1',
    [uuid, userId]
  );
  return rows.length > 0;
}

const fallbackDestinations = [
  { city: '東京', country: '日本', tripCount: 0, coverImage: '' },
  { city: '大阪', country: '日本', tripCount: 0, coverImage: '' },
  { city: '首爾', country: '韓國', tripCount: 0, coverImage: '' },
  { city: '曼谷', country: '泰國', tripCount: 0, coverImage: '' },
  { city: '香港', country: '中國香港', tripCount: 0, coverImage: '' },
  { city: '新加坡', country: '新加坡', tripCount: 0, coverImage: '' },
];

const fallbackGuides = [
  {
    id: 'guide-fallback-1',
    title: '第一次自由行，怎麼排出不趕行程？',
    summary: '用早中晚節奏切分景點、餐廳與交通，保留 20% 彈性時間。',
    city: '通用',
    authorName: 'Travel Planner',
    authorUsername: 'travel-planner',
    slug: 'first-trip-planning-starter-AB12',
    guideCode: 'AB12',
    publishedAt: null,
  },
  {
    id: 'guide-fallback-2',
    title: '預算不超支的三步驟',
    summary: '先定總額，再分配住宿/交通/餐飲比例，最後用每日預算追蹤。',
    city: '通用',
    authorName: 'Travel Planner',
    authorUsername: 'travel-planner',
    slug: 'budget-control-steps-CD34',
    guideCode: 'CD34',
    publishedAt: null,
  },
  {
    id: 'guide-fallback-3',
    title: '雨天備案與室內景點替代法',
    summary: '每一天預先準備 1-2 個室內替代點，避免天候影響行程品質。',
    city: '通用',
    authorName: 'Travel Planner',
    authorUsername: 'travel-planner',
    slug: 'rainy-day-plan-EF56',
    guideCode: 'EF56',
    publishedAt: null,
  },
];

const fallbackBuddies = [
  {
    id: 'buddy-fallback-1',
    city: '台灣台北市',
    startDate: null,
    endDate: null,
    note: '想找一起吃在地小吃、拍街景的旅伴。',
    displayName: '旅人 A',
  },
  {
    id: 'buddy-fallback-2',
    city: '日本大阪',
    startDate: null,
    endDate: null,
    note: '白天景點、晚上居酒屋，歡迎一起安排行程。',
    displayName: '旅人 B',
  },
];

router.get('/guides', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 48);
  const city = String(req.query.city || '').trim();
  const keyword = String(req.query.q || '').trim();

  try {
    const rows = await fetchPublicGuideRows(limit, { city, keyword });
    const guides = rows.length > 0 ? rows.map(mapGuideListRow) : fallbackGuides.slice(0, limit);
    return res.json({ guides });
  } catch (err) {
    console.error('Get guides error:', err);
    return res.status(500).json({ error: '取得指南列表失敗' });
  }
});

router.get('/guides/:guideSlug', async (req, res) => {
  try {
    const guide = await getPublicGuideBySlug(req.params.guideSlug);
    if (!guide) return res.status(404).json({ error: '找不到該指南' });
    return res.json({ guide });
  } catch (err) {
    console.error('Get guide detail error:', err);
    return res.status(500).json({ error: '取得指南詳情失敗' });
  }
});

router.get('/u/:username/guide/:guideSlug', async (req, res) => {
  try {
    const guide = await getPublicGuideBySlug(req.params.guideSlug);
    if (!guide) return res.status(404).json({ error: '找不到該用戶的指南' });
    return res.json({ guide });
  } catch (err) {
    console.error('Get user guide detail error:', err);
    return res.status(500).json({ error: '取得用戶指南詳情失敗' });
  }
});

router.get('/home/content', async (req, res) => {
  const destinationLimit = Math.min(Number(req.query.destinationLimit) || 8, 24);
  const guideLimit = Math.min(Number(req.query.guideLimit) || 6, 24);
  const buddyLimit = Math.min(Number(req.query.buddyLimit) || 6, 24);
  const tripLimit = Math.min(Number(req.query.tripLimit) || 6, 24);

  try {
    let destinations = [];
    try {
      const { rows } = await pool.query(
        `SELECT city, cover_image
         FROM cities
         WHERE is_active = true
         ORDER BY score DESC, updatedat DESC
         LIMIT $1`,
        [destinationLimit]
      );
      destinations = rows.map((row) => ({
        city: row.city,
        country: row.country || '',
        tripCount: Number(row.trip_count) || 0,
        coverImage: row.cover_image || '',
      }));
    } catch (err) {
      if (err.code !== '42P01' && err.code !== '42703') throw err;
    }

    if (destinations.length === 0) {
      const { rows } = await pool.query(
        `SELECT city, COUNT(*)::int AS trip_count
         FROM itineraries
         WHERE ispublic = true AND city IS NOT NULL AND city <> ''
         GROUP BY city
         ORDER BY trip_count DESC, city ASC
         LIMIT $1`,
        [destinationLimit]
      );
      destinations = rows.map((row) => ({
        city: row.city,
        country: '',
        tripCount: Number(row.trip_count) || 0,
        coverImage: '',
      }));
    }

    if (destinations.length === 0) {
      destinations = fallbackDestinations.slice(0, destinationLimit);
    }

    let guides = [];
    try {
      const rows = await fetchPublicGuideRows(guideLimit);
      guides = rows.length > 0 ? rows.map(mapGuideListRow) : fallbackGuides.slice(0, guideLimit);
    } catch (err) {
      if (err.code !== '42P01' && err.code !== '42703') throw err;
      guides = fallbackGuides.slice(0, guideLimit);
    }

    let buddyPosts = [];
    try {
      const { rows } = await pool.query(
        `SELECT id, city, start_date, end_date, note, display_name
         FROM travel_buddy_posts
         WHERE status = 'open'
         ORDER BY createdat DESC
         LIMIT $1`,
        [buddyLimit]
      );
      buddyPosts = rows.map((row) => ({
        id: `buddy-${row.id}`,
        city: row.city || '',
        startDate: toISODate(row.start_date),
        endDate: toISODate(row.end_date),
        note: row.note || '',
        displayName: row.display_name || '匿名旅人',
      }));
    } catch (err) {
      if (err.code !== '42P01' && err.code !== '42703') throw err;
    }

    if (buddyPosts.length === 0) {
      buddyPosts = fallbackBuddies.slice(0, buddyLimit);
    }

    const publicTripsResult = await pool.query(
      `SELECT i.uuid, i.title, i.summary, i.city, i.startdate, i.updatedat, u.displayname, u.email
       FROM itineraries i
       JOIN users u ON u.id = i.userid
       WHERE i.ispublic = true
       ORDER BY i.updatedat DESC
       LIMIT $1`,
      [tripLimit]
    );

    const publicTrips = publicTripsResult.rows.map((row) => ({
      uuid: row.uuid,
      title: row.title || row.summary || '公開旅程',
      summary: row.summary || '',
      city: row.city || '',
      startDate: toISODate(row.startdate),
      updatedAt: toISODate(row.updatedat),
      authorName: row.displayname || row.email || '匿名旅人',
    }));

    return res.json({
      destinations,
      guides,
      buddyPosts,
      publicTrips,
    });
  } catch (err) {
    console.error('Get home content error:', err);
    return res.status(500).json({ error: '取得首頁內容失敗' });
  }
});

router.get('/itineraries/public', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 48);
  try {
    const { rows } = await pool.query(
      `SELECT i.uuid, i.title, i.summary, i.city, i.startdate, i.updatedat, u.displayname, u.email
       FROM itineraries i
       JOIN users u ON u.id = i.userid
       WHERE i.ispublic = true
       ORDER BY i.updatedat DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({
      itineraries: rows.map((row) => ({
        uuid: row.uuid,
        title: row.title || row.summary || '公開旅程',
        summary: row.summary || '',
        city: row.city || '',
        startDate: toISODate(row.startdate),
        updatedAt: toISODate(row.updatedat),
        authorName: row.displayname || row.email || '匿名旅人',
      })),
    });
  } catch (err) {
    console.error('Get public itineraries error:', err);
    return res.status(500).json({ error: '取得公開行程失敗' });
  }
});

//////////////

// 以下路由都需要登入
router.use(authMiddleware);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ------------------ 定義工具 (Tools) ------------------
const tools = [
  {
    type: 'function',
    function: {
      name: 'update_itinerary',
      description: '【僅在確認起點與時間後呼叫】生成包含起點與出發時間的完整旅遊行程。',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '行程的簡短中文概要' },
          totalBudget: { 
            type: "number", 
            description: "根據行程預估的總花費建議，或使用者要求的預算上限" 
          },
          city: { 
            type: 'string', 
            description: '旅遊目的地城市。⚠️重要：若為國外城市，請務必包含國家名稱 (例如: "義大利威尼斯")。' 
          },
          startDate: { 
            type: 'string', 
            description: '旅遊開始日期，格式為 YYYY-MM-DD。' 
          },
          startLocation: { 
            type: 'string', 
            description: '行程第一天的出發起點（例如：飯店名稱、機場或車站）' 
          },
          startTime: { 
            type: 'string', 
            description: '第一天開始行程的時間，格式為 HH:mm (例如 "09:00")' 
          },
          days: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'number' },
                title: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      time: { 
                        type: 'string', 
                        description: '該行程的預估時間區間，請務必使用 24 小時制並以波浪號分隔 (例如 "09:30~11:30")。請根據景點特性預估合理的停留時間與交通時間。' 
                      },
                      name: { type: 'string', description: '地點的具體名稱' },
                      type: { type: 'string', enum: ['sight', 'food', 'shopping', 'activity'] },
                      note: { type: 'string' },
                      cost: { 
                        type: "number", 
                        description: "該項目的預估花費（以當地貨幣或美金估算，僅數字）" 
                      }
                    },
                    required: ['time', 'name', 'type', "cost"],
                  },
                },
              },
              required: ['day', 'items'],
            },
          },
        },
        required: ['summary', 'city', 'days', 'startLocation', 'startTime'],
      },
    },
  },
];

// ------------------ API: Chat Endpoint ------------------
router.post('/chat', async (req, res) => {
  const systemMsg = {
    role: 'system',
    content: `你是一個旅遊助手。當使用者提及預算限制（例如：我的預算是兩萬）或要求行程時：
    1. 請估算各項活動 cost。
    2. 請在 update_itinerary 的 totalBudget 欄位填入：
      - 若使用者有指定預算，則填入該金額。
      - 若使用者沒指定，則填入你估算完所有活動後的總和加 10% 作為緩衝。`
  };
  const { messages, currentPlan } = req.body; 
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  const today = new Date().toISOString().split('T')[0];

  const city = currentPlan?.city || '依據對話判斷';
  const daysCount = currentPlan?.days?.length ? `${currentPlan.days.length} 天` : '依據對話判斷';

  // 🔥 構建 System Prompt：調整為「主動型」助理
  let systemContent = `你是一位專業的全球旅遊行程規劃助理。今天是 ${today}。
    【目前的行程背景資訊】
    - 目的地：${city}
    - 旅遊天數：${daysCount} 天
    - 出發與日期資訊：(請參考使用者的第一句對話)

    【行程規劃標準作業程序 (SOP)】：
    系統已經透過前端介面獲取了上述的旅遊資訊，請依照以下最高指導原則進行對話與規劃：
    一、 對話與互動邏輯
    1. 【禁止確認已知資訊】：絕對不要再向使用者詢問「目的地在哪」、「去幾天」或「從哪裡出發/住宿地點」。
    2. 【大方給予推薦】：當使用者單純詢問「推薦美食」、「推薦住宿」、「交通方式」或「景點介紹」時，請發揮在地專家的精神，**直接用文字給出豐富、具體的推薦名單與詳細介紹**。絕對禁止回答「我無法推薦」或「我只能規劃行程」。
    3. 【保護現有行程 (⚠️極重要)】：在回答上述的「一般問答與推薦」時，**絕對不要呼叫 'update_itinerary' 工具**去覆蓋或修改使用者現有的行程！請單純用文字回覆即可。只有當使用者明確指示「請幫我把這些加入行程」或「幫我重新排行程」時，才可以使用工具。
    4. 【直接給予規劃】：當使用者明確說「幫我排行程」或要求生成完整路線時，請直接呼叫 'update_itinerary' 工具生成行程，不要拖泥帶水。

    二、 行程生成規則 (⚠️極重要，攸關系統運作⚠️)
    當你明確收到指令並呼叫 'update_itinerary' 工具時，必須嚴格遵守以下系統層級的限制：
    1. 【嚴格限制地理範圍】：所有安排的景點、餐廳與活動，必須嚴格位於「${city}」這個城市或其合理的周邊通勤範圍內。絕對禁止產生跨越極遠縣市的行程（例如：台北的行程絕對不能出現南投、高雄的景點）。請在加入清單前，務必確認該地點的真實地理位置。
    2. 【禁止生成交通與過渡節點】：前端系統具有「自動計算真實交通時間」的功能！行程清單 (items) 中 只能包含實際造訪的實體「景點」、「餐廳」或「店家」。
      - ❌ 絕對禁止產生：「搭乘捷運」、「步行前往」、「交通時間」、「回到住宿休息」、「自由活動」等非實體地點項目。
    3. 【停留時間設定】：請為每個實體景點評估合理的停留時間區間（格式為 "HH:mm~HH:mm"，例如 "09:30~11:30"）。
      - 評估基準：大型景點 2-3 小時、小型景點 1 小時、用餐 1.5 小時。
      - ⚠️ 注意：你只需要給出該景點的「停留時間」，絕對不需要在兩個景點之間手動預留交通空檔，系統會自己把後續時間往後推算。
    4. 【每日統一出發時間】：每一天的第一個景點，請一律預設從 "09:00" 開始安排（除非使用者明確要求其他時間）。`;

  // 注入記憶
  if (currentPlan) {
    systemContent += `
    
    --------------------------------------------------
    【⚠️ 目前已有的行程資料 (Current Itinerary)】
    以下是使用者目前的行程表，請基於此資料進行修改，不要刪除既有內容：
    ${JSON.stringify(currentPlan)}
    --------------------------------------------------
    `;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages: [
        { role: 'system', content: systemContent },
        ...messages
      ],
      tools: tools,
      tool_choice: 'auto',
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.tool_calls) {
      const toolCall = responseMessage.tool_calls[0];
      if (toolCall.function.name === 'update_itinerary') {
        const itineraryArgs = JSON.parse(toolCall.function.arguments);
        const reply = `沒問題！已為您規劃從 **${itineraryArgs.startLocation}** 於 **${itineraryArgs.startTime}** 出發的行程。`;
        return res.json({
          role: 'assistant',
          content: `沒問題！已為您生成行程：${itineraryArgs.summary} ${itineraryArgs.startDate ? `(出發日: ${itineraryArgs.startDate})` : ''}，您可以再告訴我需要調整哪裡。`,
          plan: itineraryArgs,
        });
      }
    }

    return res.json({
      role: 'assistant',
      content: responseMessage.content,
      plan: null,
    });

  } catch (err) {
    console.error('OpenAI Error:', err);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

router.post('/places/search', async (req, res) => {
  const { query, city, center } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query is required' });
  try {
    const fullQuery = city ? `${city} ${query}` : query;
    const params = { query: fullQuery, key: process.env.GOOGLE_PLACES_API_KEY, language: 'zh-TW' };
    if (center && center.lat && center.lng) {
      params.location = `${center.lat},${center.lng}`;
      params.radius = 10000; 
    }
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', { params });
    const places = (response.data.results || []).slice(0, 3).map((r) => ({
      name: r.name, address: r.formatted_address, lat: r.geometry?.location?.lat, lng: r.geometry?.location?.lng,
      placeId: r.place_id, rating: r.rating, userRatingsTotal: r.user_ratings_total, photoReference: r.photos?.[0]?.photo_reference || null,
    }));
    return res.json({ places });
  } catch (err) { return res.status(500).json({ error: 'Failed' }); }
});

router.get('/place-details', async (req, res) => {
  const { placeId } = req.query;
  if (!placeId) return res.status(400).send('Missing placeId');
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'name,formatted_address,rating,user_ratings_total,types,photos,editorial_summary,reviews,geometry', 
        language: 'zh-TW',
        key: process.env.GOOGLE_PLACES_API_KEY,
      },
    });
    res.json(response.data.result || {});
  } catch (err) { res.status(500).send('Failed'); }
});

router.post('/directions', async (req, res) => {
  const { origin, destination, mode } = req.body || {};
  if (!origin || !destination) return res.status(400).json({ error: 'Missing params' });

  try {
    // 判斷傳入的是物件還是字串
    const originParam = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
    const destParam = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;

    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: originParam,
        destination: destParam,
        // 建議預設改為 TRANSIT (大眾運輸) 或 DRIVING
        mode: (mode || 'TRANSIT').toLowerCase(), 
        language: 'zh-TW',
        key: process.env.GOOGLE_DIRECTIONS_API_KEY || process.env.GOOGLE_PLACES_API_KEY,
      },
    });

    const route = response.data.routes[0];
    const leg = route?.legs[0];
    if (!leg) return res.status(400).json({ error: 'No routes found' });

    res.json(response.data);
  } catch (err) {
    console.error('Directions API Error:', err.response?.data || err.message);
    res.status(500).send('Failed');
  }
});

router.post('/weather', async (req, res) => {
  const { city, startDate } = req.body;
  if (!city || !startDate) return res.status(400).json({ error: 'Missing' });
  try {
    const start = new Date(startDate);
    const now = new Date();
    const diffDays = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    if (diffDays > 14) return res.json({ daily: null, reason: 'Date too far' });
    const placeRes = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', { params: { query: city, key: process.env.GOOGLE_PLACES_API_KEY, language: 'zh-TW' } });
    const location = placeRes.data.results?.[0]?.geometry?.location;
    if (!location) return res.status(404).json({ error: 'City not found' });
    const endDate = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const weatherRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: { latitude: location.lat, longitude: location.lng, daily: 'weathercode,temperature_2m_max,temperature_2m_min', timezone: 'auto', start_date: startDate, end_date: endDate }
    });
    res.json({ daily: weatherRes.data.daily });
  } catch (err) { res.json({ daily: null }); }
});

// ------------------ 行前清單 CRUD ------------------
router.get('/itineraries/:uuid/checklist', async (req, res) => {
  const { uuid } = req.params;
  try {
    const allowed = await itineraryBelongsToUser(pool, uuid, req.user.id);
    if (!allowed) return res.status(404).json({ error: '行程不存在或無權限' });

    const checklistItems = await readChecklistItemsByUuid(pool, uuid);
    res.json({ checklistItems: checklistItems || [] });
  } catch (err) {
    console.error('Get checklist error:', err);
    res.status(500).json({ error: '取得行前清單失敗' });
  }
});

router.post('/itineraries/:uuid/checklist', async (req, res) => {
  const { uuid } = req.params;
  const normalizedItem = normalizeChecklistItem(req.body, 0);
  if (!normalizedItem) return res.status(400).json({ error: '清單項目內容不可為空' });

  try {
    const allowed = await itineraryBelongsToUser(pool, uuid, req.user.id);
    if (!allowed) return res.status(404).json({ error: '行程不存在或無權限' });

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM itinerary_checklist_items WHERE itinerary_uuid = $1',
      [uuid]
    );
    const count = Number(countResult.rows[0]?.count) || 0;
    if (count >= CHECKLIST_LIMIT) {
      return res.status(400).json({ error: `行前清單最多 ${CHECKLIST_LIMIT} 項` });
    }

    const sortOrder = Number.isFinite(Number(req.body?.sortOrder))
      ? Math.max(0, Number(req.body.sortOrder))
      : count;

    try {
      const { rows } = await pool.query(
        `INSERT INTO itinerary_checklist_items (itinerary_uuid, item_text, is_checked, is_reminder, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, item_text, is_checked, is_reminder, sort_order`,
        [uuid, normalizedItem.text, normalizedItem.checked, normalizedItem.reminder, sortOrder]
      );

      const row = rows[0];
      return res.status(201).json({
        item: {
          id: row.id,
          text: row.item_text,
          checked: Boolean(row.is_checked),
          reminder: Boolean(row.is_reminder),
          sortOrder: Number(row.sort_order) || 0,
        },
      });
    } catch (e) {
      if (e.code !== '42703') throw e;

      const { rows } = await pool.query(
        `INSERT INTO itinerary_checklist_items (itinerary_uuid, item_text, is_checked, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id, item_text, is_checked, sort_order`,
        [uuid, normalizedItem.text, normalizedItem.checked, sortOrder]
      );

      const row = rows[0];
      return res.status(201).json({
        item: {
          id: row.id,
          text: row.item_text,
          checked: Boolean(row.is_checked),
          reminder: false,
          sortOrder: Number(row.sort_order) || 0,
        },
      });
    }
  } catch (err) {
    console.error('Create checklist item error:', err);
    res.status(500).json({ error: '新增行前清單項目失敗' });
  }
});

router.patch('/itineraries/:uuid/checklist/:itemId', async (req, res) => {
  const { uuid, itemId } = req.params;
  const itemIdNum = Number(itemId);
  if (!Number.isFinite(itemIdNum) || itemIdNum <= 0) {
    return res.status(400).json({ error: '項目識別碼格式錯誤' });
  }

  const hasText = Object.prototype.hasOwnProperty.call(req.body || {}, 'text');
  const hasChecked = Object.prototype.hasOwnProperty.call(req.body || {}, 'checked');
  const hasReminder = Object.prototype.hasOwnProperty.call(req.body || {}, 'reminder');
  const hasSortOrder = Object.prototype.hasOwnProperty.call(req.body || {}, 'sortOrder');

  if (!hasText && !hasChecked && !hasReminder && !hasSortOrder) {
    return res.status(400).json({ error: '沒有可更新的欄位' });
  }

  const setClauses = [];
  const values = [];

  if (hasText) {
    const text = String(req.body.text || '').trim().slice(0, CHECKLIST_TEXT_MAX_LENGTH);
    if (!text) return res.status(400).json({ error: '清單項目內容不可為空' });
    values.push(text);
    setClauses.push(`item_text = $${values.length}`);
  }

  if (hasChecked) {
    values.push(Boolean(req.body.checked));
    setClauses.push(`is_checked = $${values.length}`);
  }

  if (hasReminder) {
    values.push(Boolean(req.body.reminder));
    setClauses.push(`is_reminder = $${values.length}`);
  }

  if (hasSortOrder) {
    const sortOrder = Number(req.body.sortOrder);
    if (!Number.isFinite(sortOrder)) return res.status(400).json({ error: '排序值格式錯誤' });
    values.push(Math.max(0, sortOrder));
    setClauses.push(`sort_order = $${values.length}`);
  }

  values.push(uuid, req.user.id, itemIdNum);
  const itineraryUuidIndex = values.length - 2;
  const userIdIndex = values.length - 1;
  const itemIdIndex = values.length;

  const buildUpdateSql = (clauses, includeReminderColumn = true) => {
    const safeClauses = includeReminderColumn
      ? clauses
      : clauses.filter((clause) => !clause.startsWith('is_reminder ='));

    if (safeClauses.length === 0) return null;

    return `UPDATE itinerary_checklist_items c
            SET ${safeClauses.join(', ')},
                updatedat = CURRENT_TIMESTAMP
            FROM itineraries i
            WHERE c.itinerary_uuid = i.uuid
              AND i.uuid = $${itineraryUuidIndex}
              AND i.userid = $${userIdIndex}
              AND c.id = $${itemIdIndex}
            RETURNING c.id, c.item_text, c.is_checked, c.is_reminder, c.sort_order`;
  };

  try {
    let querySql = buildUpdateSql(setClauses, true);
    if (!querySql) return res.status(400).json({ error: '沒有可更新的欄位' });

    let result;
    try {
      result = await pool.query(querySql, values);
    } catch (e) {
      if (e.code !== '42703') throw e;

      querySql = buildUpdateSql(setClauses, false);
      if (!querySql) {
        return res.status(400).json({ error: '目前資料庫尚未支援 reminder 欄位，請先更新資料表' });
      }

      result = await pool.query(
        querySql.replace('c.is_reminder, ', ''),
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '清單項目不存在或無權限' });
      }

      const row = result.rows[0];
      return res.json({
        item: {
          id: row.id,
          text: row.item_text,
          checked: Boolean(row.is_checked),
          reminder: false,
          sortOrder: Number(row.sort_order) || 0,
        },
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '清單項目不存在或無權限' });
    }

    const row = result.rows[0];
    return res.json({
      item: {
        id: row.id,
        text: row.item_text,
        checked: Boolean(row.is_checked),
        reminder: Boolean(row.is_reminder),
        sortOrder: Number(row.sort_order) || 0,
      },
    });
  } catch (err) {
    console.error('Update checklist item error:', err);
    res.status(500).json({ error: '更新行前清單項目失敗' });
  }
});

router.delete('/itineraries/:uuid/checklist/:itemId', async (req, res) => {
  const { uuid, itemId } = req.params;
  const itemIdNum = Number(itemId);
  if (!Number.isFinite(itemIdNum) || itemIdNum <= 0) {
    return res.status(400).json({ error: '項目識別碼格式錯誤' });
  }

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM itinerary_checklist_items c
       USING itineraries i
       WHERE c.itinerary_uuid = i.uuid
         AND i.uuid = $1
         AND i.userid = $2
         AND c.id = $3`,
      [uuid, req.user.id, itemIdNum]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: '清單項目不存在或無權限' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete checklist item error:', err);
    res.status(500).json({ error: '刪除行前清單項目失敗' });
  }
});

// ------------------ 行程 CRUD ------------------
router.get('/itineraries', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT uuid, title, summary, city, startdate, starttime, createdat, updatedat FROM itineraries WHERE userid = $1 ORDER BY updatedat DESC',
      [req.user.id]
    );
    res.json({ itineraries: rows.map((row) => ({ ...row, starttime: toHHmm(row.starttime) })) });
  } catch (err) {
    console.error('Get itineraries error:', err);
    res.status(500).json({ error: '取得行程列表失敗' });
  }
});

router.post('/itineraries', async (req, res) => {
  const { title, summary, city, startDate, startTime, itineraryData, tripNote, checklistItems } = req.body;
  if (!itineraryData) return res.status(400).json({ error: '行程資料不可為空' });
  const uuid = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO itineraries (userid, uuid, title, summary, city, startdate, starttime, note, itinerarydata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING uuid, createdat`,
      [
        req.user.id,
        uuid,
        title || '',
        summary || '',
        city || '',
        startDate || null,
        toHHmm(startTime || itineraryData?.startTime),
        tripNote || itineraryData?.tripNote || null,
        JSON.stringify(itineraryData),
      ]
    );

    await replaceChecklistItems(client, uuid, checklistItems || itineraryData?.packingItems || []);
    await client.query('COMMIT');

    res.status(201).json({ uuid: rows[0].uuid, createdAt: rows[0].createdat });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create itinerary error:', err);
    res.status(500).json({ error: '保存行程失敗' });
  } finally {
    client.release();
  }
});

router.get('/itineraries/:uuid', async (req, res) => {
  const { uuid } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM itineraries WHERE uuid = $1 AND userid = $2',
      [uuid, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: '行程不存在' });
    const row = rows[0];
    let itineraryData;
    try { itineraryData = JSON.parse(row.itinerarydata); } catch { itineraryData = null; }
    const checklistItems = await readChecklistItemsByUuid(pool, row.uuid);
    const fallbackChecklist = normalizeChecklistItems(itineraryData?.packingItems || []).map((item, idx) => ({ ...item, id: `legacy-${idx}` }));
    res.json({
      uuid: row.uuid,
      title: row.title,
      summary: row.summary,
      city: row.city,
      startDate: row.startdate,
      startTime: toHHmm(row.starttime || itineraryData?.startTime),
      tripNote: row.note || itineraryData?.tripNote || '',
      checklistItems: checklistItems ?? fallbackChecklist,
      itineraryData,
      createdAt: row.createdat,
      updatedAt: row.updatedat,
    });
    
  } catch (err) {
    console.error('Get itinerary error:', err);
    res.status(500).json({ error: '取得行程失敗' });
  }
});

router.put('/itineraries/:uuid', async (req, res) => {
  const { uuid } = req.params;
  const { title, summary, city, startDate, startTime, itineraryData, tripNote, checklistItems } = req.body;
  if (!itineraryData) return res.status(400).json({ error: '行程資料不可為空' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE itineraries
       SET title = $1,
           summary = $2,
           city = $3,
           startdate = $4,
           starttime = $5,
           note = $6,
           itinerarydata = $7,
           updatedat = CURRENT_TIMESTAMP
       WHERE uuid = $8 AND userid = $9`,
      [
        title || '',
        summary || '',
        city || '',
        startDate || null,
        toHHmm(startTime || itineraryData?.startTime),
        tripNote || itineraryData?.tripNote || null,
        JSON.stringify(itineraryData),
        uuid,
        req.user.id,
      ]
    );

    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '行程不存在或無權限' });
    }

    await replaceChecklistItems(client, uuid, checklistItems || itineraryData?.packingItems || []);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update itinerary error:', err);
    res.status(500).json({ error: '更新行程失敗' });
  } finally {
    client.release();
  }
});

router.delete('/itineraries/:uuid', async (req, res) => {
  const { uuid } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM itineraries WHERE uuid = $1 AND userid = $2',
      [uuid, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: '行程不存在或無權限' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete itinerary error:', err);
    res.status(500).json({ error: '刪除行程失敗' });
  }
});

// 其他 API
router.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = router;
