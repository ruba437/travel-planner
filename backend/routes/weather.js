const express = require('express');
const router = express.Router();
const axios = require('axios');

// POST /api/weather
router.post('/', async (req, res) => {
  const { city, startDate } = req.body;
  if (!city || !startDate) return res.status(400).json({ error: 'Missing' });
  try {
    const start = new Date(startDate);
    const now = new Date();
    const diffDays = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    if (diffDays > 14) return res.json({ daily: null, reason: 'Date too far' });
    
    const placeRes = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', { 
      params: { query: city, key: process.env.GOOGLE_PLACES_API_KEY, language: 'zh-TW' } 
    });
    
    const location = placeRes.data.results?.[0]?.geometry?.location;
    if (!location) return res.status(404).json({ error: 'City not found' });
    
    const endDate = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const weatherRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: { latitude: location.lat, longitude: location.lng, daily: 'weathercode,temperature_2m_max,temperature_2m_min', timezone: 'auto', start_date: startDate, end_date: endDate }
    });
    
    res.json({ daily: weatherRes.data.daily });
  } catch (err) { 
    res.json({ daily: null }); 
  }
});

module.exports = router;