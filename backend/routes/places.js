const express = require('express');
const router = express.Router();
const axios = require('axios');
const { err } = require('../utils/response');

const normalizeDirectionPoint = (point) => {
  if (!point) return null;

  if (typeof point === 'string') {
    const text = point.trim();
    return text || null;
  }

  if (typeof point !== 'object') return null;

  const placeId = String(point.placeId || point.place_id || '').trim();
  if (placeId) {
    return `place_id:${placeId}`;
  }

  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `${lat},${lng}`;
  }

  const name = String(point.name || '').trim();
  return name || null;
};

router.get('/photo', async (req, res) => {
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

router.post('/search', async (req, res) => {
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

router.get('/details', async (req, res) => {
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
    const originParam = normalizeDirectionPoint(origin);
    const destParam = normalizeDirectionPoint(destination);
    if (!originParam || !destParam) return res.status(400).json({ error: 'Missing params' });

    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: originParam,
        destination: destParam,
        mode: (mode || 'TRANSIT').toLowerCase(), 
        language: 'zh-TW',
        key: process.env.GOOGLE_DIRECTIONS_API_KEY || process.env.GOOGLE_PLACES_API_KEY,
      },
    });

    const route = response.data.routes[0];
    const leg = route?.legs[0];
    if (!leg) return res.status(200).json({ error: 'No routes found' });

    res.json(response.data);
  } catch (err) {
    console.error('Directions API Error:', err.response?.data || err.message);
    res.status(500).send('Failed');
  }
});

module.exports = router;