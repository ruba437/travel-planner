const express = require('express');
const router = express.Router();
const pool = require('../db');
const { toISODate } = require('../utils/formatters');
const { fetchPublicGuideRows, mapItineraryToGuideRow } = require('../utils/guides');


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

router.get('/content', async (req, res) => {
  const destinationLimit = Math.min(Number(req.query.destinationLimit) || 8, 24);
  const guideLimit = Math.min(Number(req.query.guideLimit) || 6, 24);
  const buddyLimit = Math.min(Number(req.query.buddyLimit) || 6, 24);
  const tripLimit = Math.min(Number(req.query.tripLimit) || 6, 24);

  try {
    // 1. 取得目的地 (包含 score)
    let destinations = [];
    try {
      const { rows } = await pool.query(
        `SELECT city, country, cover_image, score 
         FROM cities
         WHERE is_active = true
         ORDER BY score DESC NULLS LAST, updatedat DESC
         LIMIT $1`,
        [destinationLimit]
      );
      destinations = rows.map((row) => ({
        city: row.city,
        country: row.country || '',
        tripCount: 0,
        coverImage: row.cover_image || '',
        score: Number(row.score) || 0,
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
        score: 0,
      }));
    }

    if (destinations.length === 0) destinations = fallbackDestinations.slice(0, destinationLimit);

    // 2. 取得指南
    let guides = [];
    try {
      const rows = await fetchPublicGuideRows(guideLimit);
      guides = rows.length > 0 ? rows.map(mapItineraryToGuideRow) : fallbackGuides.slice(0, guideLimit);
    } catch (err) {
      if (err.code !== '42P01' && err.code !== '42703') throw err;
      guides = fallbackGuides.slice(0, guideLimit);
    }

    // 3. 取得找旅伴資訊
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

    if (buddyPosts.length === 0) buddyPosts = fallbackBuddies.slice(0, buddyLimit);

    // 4. 取得公開行程
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

    // 最終回傳
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

module.exports = router;