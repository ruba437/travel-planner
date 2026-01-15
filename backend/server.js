// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const axios = require('axios');


// 初始化 OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
app.use(cors());
app.use(express.json());

// 健康檢查: GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'backend is running' });
});

// 聊天 + 行程產生: POST /api/chat
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message || '';

  if (!userMessage) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    // 用 Chat Completions 要求 AI 回傳「只有一個 JSON」
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini', // 或改成你帳號可用的模型名稱
      messages: [
        {
          role: 'system',
          content:
            '你是一位專門幫人規劃台灣旅遊行程的助理。請務必只輸出 JSON，不要有額外文字。',
        },
        {
          role: 'user',
          content: `
            請根據下面使用者的需求，產生一個旅遊行程 JSON。格式必須完全符合：

            {
              "summary": "簡短中文概要，說明這次行程，例如：台中兩天一夜美食＋夜景行程",
              "city": "主要旅遊城市，例如：台中",
              "days": [
                {
                  "day": 1,
                  "title": "第一天主題，例如：市區景點＋夜市美食",
                  "items": [
                    {
                      "time": "morning | noon | afternoon | evening | night 其中一個",
                      "name": "景點或餐廳名稱（短）",
                      "type": "sight | food | shopping | activity 其中一個",
                      "note": "1~2 句中文說明，包含為什麼推薦、大概停留多久等"
                    }
                  ]
                }
              ]
            }

            要求：
            1. 一定要是有效的 JSON（用雙引號、不能有註解）。
            2. 不可以有任何 JSON 以外的文字說明。
            3. "days" 至少要有 2 天，如果使用者沒說天數，就幫忙猜 2~3 天。

使用者需求如下：
${userMessage}
          `.trim(),
        },
      ],
      temperature: 0.7,
    });

    const rawText = completion.choices[0]?.message?.content?.trim() || '';

    let plan = null;
    try {
      plan = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      // 解析失敗就把原始文字丟回去，至少前端有東西可顯示
      return res.json({
        reply: 'AI 回傳格式解析失敗，以下是原始內容：\n' + rawText,
        plan: null,
      });
    }

    // 到這裡代表 JSON 解析成功
    // 順便準備一段簡短回覆文字給聊天泡泡用
    const replyText =
      plan.summary ||
      `已根據你的需求規劃了 ${plan.city || '旅遊'} 行程，請看下方行程表。`;

    res.json({
      reply: replyText,
      plan, // 給前端用來畫行程表的 JSON
    });
  } catch (err) {
    console.error('Error calling OpenAI:', err);
    res.status(500).json({
      error: 'Failed to get AI response',
    });
  }
});

// ------------------ Google Places 真實座標查詢 ------------------
// POST /api/places/search
// body: { query: '景點名稱', city: '台中' }
app.post('/api/places/search', async (req, res) => {
  const { query, city } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    const fullQuery = city ? `${city} ${query}` : query;

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      {
        params: {
          query: fullQuery,
          key: process.env.GOOGLE_PLACES_API_KEY,
          language: 'zh-TW',
          region: 'tw',
        },
      },
    );

    const data = response.data;

    if (data.status !== 'OK') {
      return res.status(400).json({
        error: 'Google Places status not OK',
        status: data.status,
        error_message: data.error_message,
        places: [],
      });
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
    const details = err.response?.data || err.message || err;
    console.error('Error calling Google Places API:', details);
    return res.status(500).json({ error: 'Failed to fetch places' });
  }
});


// ------------------ Google Places Photo 代理 ------------------
// GET /api/places/photo?ref=PHOTO_REFERENCE&maxwidth=400
app.get('/api/places/photo', async (req, res) => {
  const { ref, maxwidth } = req.query;

  if (!ref) {
    return res.status(400).send('Missing photo reference');
  }

  try {
    const url = 'https://maps.googleapis.com/maps/api/place/photo';

    const response = await axios.get(url, {
      params: {
        photo_reference: ref,
        maxwidth: maxwidth || 400,
        key: process.env.GOOGLE_PLACES_API_KEY,  // 後端那把 key
      },
      responseType: 'arraybuffer', // 拿到的是圖片 binary
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.send(response.data);
  } catch (err) {
    console.error('Error fetching place photo:', err.response?.data || err.message || err);
    res.status(500).send('Failed to fetch photo');
  }
});

const required = ['OPENAI_API_KEY', 'GOOGLE_PLACES_API_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('❌ Missing env:', missing.join(', '));
  console.error('請建立 backend/.env（參考 .env.example）');
  process.exit(1);
}

// ------------------ Google Directions 路線查詢 ------------------
// POST /api/directions
// body: {
//   origin: { lat: number, lng: number },
//   destination: { lat: number, lng: number },
//   mode: 'DRIVING' | 'TRANSIT' | 'WALKING' | 'BICYCLING'
// }
app.post('/api/directions', async (req, res) => {
  const { origin, destination, mode } = req.body || {};

  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin 和 destination 都是必填' });
  }

  try {
    const url = 'https://maps.googleapis.com/maps/api/directions/json';

    const modeParam = (mode || 'TRANSIT').toLowerCase();

    const response = await axios.get(url, {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: modeParam, 
        language: 'zh-TW',
        region: 'tw',
        departure_time: Math.floor(Date.now() / 1000),
        key: process.env.GOOGLE_DIRECTIONS_API_KEY || process.env.GOOGLE_PLACES_API_KEY,
      },
    });


    const data = response.data;

    if (data.status !== 'OK') {
      return res.status(400).json({
        error: 'Google Directions status not OK',
        status: data.status,
        error_message: data.error_message,
      });
    }

    // 只取第一條 route
    const route = data.routes[0];
    const leg = route.legs[0];

    const summary = {
      distanceText: leg.distance?.text,
      durationText: leg.duration?.text,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      steps: (leg.steps || []).map((s) => ({
        // HTML 說明文字
        instructionHtml: s.html_instructions,
        distanceText: s.distance?.text,
        durationText: s.duration?.text,
        travelMode: s.travel_mode,
      })),
    };

    const encodedPolyline = route.overview_polyline?.points || null;
    const bounds = route.bounds || null;

    res.json({ summary, encodedPolyline, bounds });
  } catch (err) {
    console.error('Error calling Google Directions API:', err.response?.data || err.message || err);
    res.status(500).json({
      error: 'Failed to fetch directions',
    });
  }
});


// 啟動 server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend is running on http://localhost:${PORT}`);
});
