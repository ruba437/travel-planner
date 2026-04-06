// backend/routes/guides.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); // 確保資料庫有正確引入
const { ok, err } = require('../utils/response'); // 引入共用的回應格式
const { mapGuideListRow, mapGuideDetailRow } = require('../utils/guides');

router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 48);
  const city = String(req.query.city || '').trim();
  const keyword = String(req.query.q || '').trim();

  try {
    const rows = await fetchPublicGuideRows(limit, { city, keyword });
    const guides = rows.length > 0 ? rows.map(mapItineraryToGuideRow) : fallbackGuides.slice(0, limit);
    return res.json({ guides }); // 這裡配合前端回傳 { guides }
  } catch (error) {
    console.error('Get guides error:', error);
    return res.status(500).json({ error: '取得指南列表失敗' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const guide = await getPublicGuideBySlug(req.params.slug);
    if (!guide) return res.status(404).json({ error: '找不到該指南' });
    return res.json({ guide }); // 配合前端回傳 { guide }
  } catch (error) {
    console.error('Get guide detail error:', error);
    return res.status(500).json({ error: '取得指南詳情失敗' });
  }
});

module.exports = router;