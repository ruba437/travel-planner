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
          // 🔥 修改 1: 新增 startDate 欄位
          startDate: { 
            type: 'string', 
            description: '旅遊開始日期，格式為 YYYY-MM-DD (例如 2023-10-25)。如果使用者沒提供年份，請預設為今年或明年。' 
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

  // 取得今天的日期，讓 AI 有時間觀念
  const today = new Date().toISOString().split('T')[0];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages: [
        {
          role: 'system',
          // 🔥 修改 2: 告訴 AI 今天幾號，這樣它才能推算「下禮拜五」是幾號
          content: `你是一位專業的全球旅遊行程規劃助理。今天是 ${today}。
          
          原則：
          1. 當使用者明確表示「幫我排行程」時，請呼叫 'update_itinerary' 工具。
          2. 如果使用者有提到日期（例如「後天去」、「1月20號去」），請務必計算出正確的 YYYY-MM-DD 填入 startDate 欄位。
          3. 城市名稱若為國外，請加上國家前綴（如：日本京都）。`
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
        console.log(`AI 生成行程: ${itineraryArgs.city}, 日期: ${itineraryArgs.startDate}`);

        // 回傳給前端
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

// 🔥 新增：天氣 API Endpoint (使用 Open-Meteo)
app.post('/api/weather', async (req, res) => {
  const { city, startDate } = req.body;
  if (!city || !startDate) return res.status(400).json({ error: 'Missing city or startDate' });

  try {
    // 1. 檢查日期是否太久遠 (超過 14 天後)
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = start - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 14) {
      console.log(`[Weather] 日期 ${startDate} 太久遠，無法取得預報，跳過天氣查詢。`);
      return res.json({ daily: null, reason: 'Date too far' });
    }

    // 2. 查座標
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

    // 3. 呼叫 Open-Meteo
    console.log(`[Weather] 查詢天氣: ${city} (${startDate})`);
    
    // 計算結束日期 (預設抓 5 天)
    const endDate = new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
    // 如果 Open-Meteo 回傳錯誤 (例如日期無效)，我們把它印出來，但不要讓後端當機
    console.error('Weather API Error:', err.response?.data || err.message);
    res.json({ daily: null }); 
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});