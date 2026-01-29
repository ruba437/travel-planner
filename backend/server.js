// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const axios = require('axios');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
app.use(cors());
app.use(express.json());

// ------------------ 定義工具 (Tools) ------------------
const tools = [
  {
    type: 'function',
    function: {
      name: 'update_itinerary',
      description: '當使用者明確要求安排、規劃、修改或更新旅遊行程時呼叫此工具。',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '行程的簡短中文概要' },
          city: { 
            type: 'string', 
            description: '旅遊目的地城市。⚠️重要：若為國外城市，請務必包含國家名稱 (例如: "義大利威尼斯")。' 
          },
          startDate: { 
            type: 'string', 
            description: '旅遊開始日期，格式為 YYYY-MM-DD。' 
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
                      time: { type: 'string', enum: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
                      name: { type: 'string', description: '地點的具體名稱' },
                      type: { type: 'string', enum: ['sight', 'food', 'shopping', 'activity'] },
                      note: { type: 'string' },
                    },
                    required: ['time', 'name', 'type'],
                  },
                },
              },
              required: ['day', 'items'],
            },
          },
        },
        required: ['summary', 'city', 'days'],
      },
    },
  },
];

// ------------------ API: Chat Endpoint ------------------
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body; 
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  const today = new Date().toISOString().split('T')[0];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages: [
        {
          role: 'system',
          content: `你是一位專業的全球旅遊行程規劃助理。今天是 ${today}。
          
          原則：
          1. 當使用者明確表示「幫我排行程」時，請呼叫 'update_itinerary' 工具。
          2. 如果使用者有提到日期，請務必計算出正確的 YYYY-MM-DD 填入 startDate 欄位。
          3. 城市名稱若為國外，請加上國家前綴。`
        },
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
        return res.json({
          role: 'assistant',
          content: `好的！已為您更新行程：${itineraryArgs.summary} ${itineraryArgs.startDate ? `(出發日: ${itineraryArgs.startDate})` : ''}`,
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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ------------------ API: Places Search ------------------
app.post('/api/places/search', async (req, res) => {
  const { query, city, center } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    const fullQuery = city ? `${city} ${query}` : query;
    const params = {
      query: fullQuery,
      key: process.env.GOOGLE_PLACES_API_KEY,
      language: 'zh-TW',
    };

    if (center && center.lat && center.lng) {
      params.location = `${center.lat},${center.lng}`;
      params.radius = 10000; 
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      { params }
    );

    const data = response.data;
    if (data.status !== 'OK') {
      return res.status(400).json({ places: [] });
    }

    const places = (data.results || []).slice(0, 3).map((r) => ({
      name: r.name,
      address: r.formatted_address,
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
      placeId: r.place_id,
      rating: r.rating,
      userRatingsTotal: r.user_ratings_total,
      photoReference: r.photos?.[0]?.photo_reference || null,
    }));
    return res.json({ places });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed' });
  }
});

// 🔥 新增：取得地點詳細資訊 (簡介 + 評論)
app.get('/api/place-details', async (req, res) => {
  const { placeId } = req.query;
  if (!placeId) return res.status(400).send('Missing placeId');
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        // 我們只需要 簡介(editorial_summary) 和 評論(reviews)
        fields: 'editorial_summary,reviews', 
        language: 'zh-TW',
        key: process.env.GOOGLE_PLACES_API_KEY,
      },
    });
    // 回傳結果，如果沒有結果就回傳空物件
    res.json(response.data.result || {});
  } catch (err) {
    console.error('Place Details Error:', err.message);
    res.status(500).send('Failed');
  }
});

app.get('/api/places/photo', async (req, res) => {
  const { ref, maxwidth } = req.query;
  if (!ref) return res.status(400).send('Missing ref');
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/photo', {
      params: { photo_reference: ref, maxwidth: maxwidth || 400, key: process.env.GOOGLE_PLACES_API_KEY },
      responseType: 'arraybuffer',
    });
    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);
  } catch (err) {
    res.status(500).send('Failed');
  }
});

app.post('/api/directions', async (req, res) => {
  const { origin, destination, mode } = req.body || {};
  if (!origin || !destination) return res.status(400).json({ error: 'Missing params' });
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: (mode || 'TRANSIT').toLowerCase(),
        language: 'zh-TW',
        key: process.env.GOOGLE_DIRECTIONS_API_KEY || process.env.GOOGLE_PLACES_API_KEY,
      },
    });
    const data = response.data;
    if (data.status !== 'OK') return res.status(400).json({ error: data.status });
    const route = data.routes[0];
    const leg = route.legs[0];
    res.json({
      summary: {
        distanceText: leg.distance?.text,
        durationText: leg.duration?.text,
        steps: (leg.steps || []).map((s) => ({
          instructionHtml: s.html_instructions,
          distanceText: s.distance?.text,
          durationText: s.duration?.text,
          travelMode: s.travel_mode,
        })),
      },
      encodedPolyline: route.overview_polyline?.points,
      bounds: route.bounds,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// 天氣 API
app.post('/api/weather', async (req, res) => {
  const { city, startDate } = req.body;
  if (!city || !startDate) return res.status(400).json({ error: 'Missing city or startDate' });

  try {
    const start = new Date(startDate);
    const now = new Date();
    const diffDays = Math.ceil((start - now) / (1000 * 60 * 60 * 24));

    if (diffDays > 14) {
      return res.json({ daily: null, reason: 'Date too far' });
    }

    const placeRes = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      {
        params: {
          query: city,
          key: process.env.GOOGLE_PLACES_API_KEY,
          language: 'zh-TW',
        },
      }
    );

    const location = placeRes.data.results?.[0]?.geometry?.location;
    if (!location) return res.status(404).json({ error: 'City not found' });

    const endDate = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const weatherRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: location.lat,
        longitude: location.lng,
        daily: 'weathercode,temperature_2m_max,temperature_2m_min',
        timezone: 'auto',
        start_date: startDate,
        end_date: endDate, 
      }
    });

    res.json({ daily: weatherRes.data.daily });

  } catch (err) {
    console.error('Weather API Error:', err.response?.data || err.message);
    res.json({ daily: null }); 
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});