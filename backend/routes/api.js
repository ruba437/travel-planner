// backend/routes/api.js
const express = require('express');
const router = express.Router();

// 1. 引入所有子模組
const placesRoutes = require('./places');
const itinerariesRoutes = require('./itineraries');
const chatRoutes = require('./chat');
const citiesRoutes = require('./cities');
const usersRoutes = require('./users');
const poisRoutes = require('./pois');
const trendingRoutes = require('./trending');
const guidesRoutes = require('./guides');
const homeRoutes = require('./home');
const uRoutes = require('./u');
const weatherRoutes = require('./weather');

// 2. 系統健康檢查 (唯一留下來的獨立 API)
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// 3. 掛載所有子路由
router.use('/places', placesRoutes);
router.use('/itineraries', itinerariesRoutes);
router.use('/chat', chatRoutes);
router.use('/cities', citiesRoutes);
router.use('/users', usersRoutes);
router.use('/pois', poisRoutes);
router.use('/trending', trendingRoutes);
router.use('/guides', guidesRoutes);
router.use('/home', homeRoutes);
router.use('/u', uRoutes);
router.use('/weather', weatherRoutes);

// 4. 匯出 router
module.exports = router;
