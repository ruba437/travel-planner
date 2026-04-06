const express = require('express');
const router = express.Router();
const { getPublicGuideBySlug } = require('../utils/guides');

// GET /api/u/:username/guide/:guideSlug
router.get('/:username/guide/:guideSlug', async (req, res) => {
  try {
    // 這裡我們共用了 guides.js 的核心查詢邏輯
    const guide = await getPublicGuideBySlug(req.params.guideSlug);
    if (!guide) return res.status(404).json({ error: '找不到該用戶的指南' });
    return res.json({ guide });
  } catch (err) {
    console.error('Get user guide detail error:', err);
    return res.status(500).json({ error: '取得用戶指南詳情失敗' });
  }
});

module.exports = router;