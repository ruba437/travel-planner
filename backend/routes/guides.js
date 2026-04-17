// backend/routes/guides.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { ok, err } = require('../utils/response');
const crypto = require('crypto');
const {
  mapItineraryToGuideRow,
  mapItineraryToGuideDetailRow,
  mapItineraryToPlannerFormat,
  fetchPublicGuideRows,
  getPublicGuideBySlug,
  getPublicItineraryBySlug,
  safeParseItineraryData
} = require('../utils/guides');

// 以下為備用指南（若資料庫為空）
const fallbackGuides = [];

// ========== 既有公開指南端點 ==========

// GET /api/guides - 列出公開指南（用於 CityGuidePage）
router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 48);
  const city = String(req.query.city || '').trim();
  const keyword = String(req.query.q || '').trim();

  try {
    const rows = await fetchPublicGuideRows(limit, { city, keyword });
    const guides = rows.length > 0 ? rows.map(mapItineraryToGuideRow) : fallbackGuides.slice(0, limit);
    return res.json({ guides });
  } catch (error) {
    console.error('Get guides error:', error);
    return res.status(500).json({ error: '取得指南列表失敗' });
  }
});

// ========== 新增：公開行程 Planner 端點 ==========

// GET /api/guides/:slug/itinerary - 取得公開行程的完整資料（用於公開 Planner 檢視）
router.get('/:slug/itinerary', async (req, res) => {
  try {
    const result = await getPublicItineraryBySlug(req.params.slug);
    if (!result) {
      return res.status(404).json({ error: '找不到該公開行程' });
    }
    return res.json({
      success: true,
      data: result.formatted
    });
  } catch (error) {
    console.error('Get public itinerary error:', error);
    return res.status(500).json({ error: '取得公開行程失敗' });
  }
});

// GET /api/guides/:slug - 指南詳情（用於 GuideDetailPage）
router.get('/:slug', async (req, res) => {
  try {
    const guide = await getPublicGuideBySlug(req.params.slug);
    if (!guide) return res.status(404).json({ error: '找不到該指南' });
    return res.json({ guide });
  } catch (error) {
    console.error('Get guide detail error:', error);
    return res.status(500).json({ error: '取得指南詳情失敗' });
  }
});

// POST /api/guides/:slug/save - 保存公開行程到使用者自己的行程（需登入）
router.post('/:slug/save', authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: '未登入或權限不足' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 查詢公開行程（須 ispublic=true）
    const publicResult = await client.query(
      `SELECT i.uuid, i.userid, i.title, i.summary, i.city, i.startdate, i.starttime, i.note, i.itinerarydata,
              i.downloads_count
       FROM itineraries i
       WHERE i.ispublic = true AND i.uuid = $1
       LIMIT 1`,
      [req.params.slug]
    );

    if (publicResult.rows.length === 0) {
      throw new Error('找不到該公開行程或行程未發佈');
    }

    const publicItinerary = publicResult.rows[0];

    // 2. 檢查是否已經下載過（防止重複計數）
    const downloadCheckResult = await client.query(
      `SELECT 1 FROM itinerary_downloads
       WHERE itinerary_uuid = $1 AND downloader_userid = $2
       LIMIT 1`,
      [publicItinerary.uuid, userId]
    );

    const isFirstDownload = downloadCheckResult.rows.length === 0;

    // 3. 生成新的 UUID 給使用者的副本
    const newItineraryUuid = crypto.randomUUID();

    // 4. 建立使用者自己的行程副本（ispublic=false）
    const insertResult = await client.query(
      `INSERT INTO itineraries (userid, uuid, title, summary, city, startdate, starttime, note, itinerarydata, ispublic)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
       RETURNING id, uuid`,
      [
        userId,
        newItineraryUuid,
        publicItinerary.title || '複製的行程',
        publicItinerary.summary || '',
        publicItinerary.city || '',
        publicItinerary.startdate,
        publicItinerary.starttime,
        publicItinerary.note || '',
        publicItinerary.itinerarydata
      ]
    );

    // 5. 若為首次下載，記錄下載追蹤並累加下載量
    if (isFirstDownload) {
      await client.query(
        `INSERT INTO itinerary_downloads (itinerary_uuid, downloader_userid)
         VALUES ($1, $2)`,
        [publicItinerary.uuid, userId]
      );

      await client.query(
        `UPDATE itineraries SET downloads_count = downloads_count + 1
         WHERE uuid = $1`,
        [publicItinerary.uuid]
      );
    }

    await client.query('COMMIT');

    const newUuid = insertResult.rows[0]?.uuid;
    return res.json({
      success: true,
      message: '已保存到我的行程',
      data: {
        newUuid,
        isFirstDownload
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Save public itinerary error:', error);
    return res.status(500).json({
      error: error.message || '保存行程失敗'
    });
  } finally {
    client.release();
  }
});

module.exports = router;