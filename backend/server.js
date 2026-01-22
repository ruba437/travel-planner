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
          // 🔥 修改重點 1: 強制 AI 在這裡填寫 "國家+城市"
          city: { 
            type: 'string', 
            description: '旅遊目的地城市。⚠️重要：若為國外城市，請務必包含國家名稱以避免地圖搜尋錯誤 (例如: "義大利威尼斯"、"日本東京"、"美國紐約")。若是台灣城市則直接寫城市名 (例如: "台北")。' 
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
                      // 🔥 修改重點 2: 提示 AI 提供更精確的景點原名或全名
                      name: { type: 'string', description: '地點的具體名稱。國外景點建議附上原文名稱以便搜尋 (例如: "聖馬可廣場 (Piazza San Marco)")' },
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

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages: [
        {
          role: 'system',
          // 🔥 修改重點 3: 加強 System Prompt 的地理概念
          content: `你是一位專業的全球旅遊行程規劃助理。
          
          原則：
          1. 規劃行程時，請確保景點名稱具體且真實存在。
          2. 當使用者明確表示「幫我排行程」、「更新行程」時，請呼叫 'update_itinerary' 工具。
          3. 【關鍵規則】：針對城市名稱 (city)，如果是國外，請務必加上國家前綴，例如「日本京都」、「法國巴黎」、「泰國曼谷」，這對地圖定位非常重要。
          4. 景點名稱請盡量提供「中文+原文」，例如「羅浮宮 (Louvre Museum)」。`
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
        console.log(`AI 生成行程: ${itineraryArgs.city} - ${itineraryArgs.summary}`);

        return res.json({
          role: 'assistant',
          content: `好的！已為您更新行程：${itineraryArgs.summary}`,
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
    // 組合查詢：如果是找城市本身，query 就是 "義大利威尼斯"，這樣搜尋非常準確
    // 如果是找景點，則是 "義大利威尼斯 聖馬可廣場"
    const fullQuery = city ? `${city} ${query}` : query;
    console.log(`搜尋: ${fullQuery}, Center Bias:`, center ? 'YES' : 'NO');

    const params = {
      query: fullQuery,
      key: process.env.GOOGLE_PLACES_API_KEY,
      language: 'zh-TW',
    };

    // 只有當真的有有效的 center 時才鎖定範圍
    if (center && center.lat && center.lng) {
      params.location = `${center.lat},${center.lng}`;
      params.radius = 10000; // 10km bias
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

// Photo API
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

// Directions API
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});