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
// 讓 AI 知道它有一個能力叫 "update_itinerary"
const tools = [
  {
    type: 'function',
    function: {
      name: 'update_itinerary',
      description: '當使用者明確要求安排、規劃、修改或更新旅遊行程時呼叫此工具。如果只是詢問景點資訊或聊天，請不要呼叫此工具。',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '行程的簡短中文概要' },
          city: { type: 'string', description: '主要旅遊城市' },
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
                      name: { type: 'string' },
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
  // 前端傳來的完整對話紀錄 (history)，而不只是單一句 message
  // 格式: [{role: 'user', content: '...'}, {role: 'assistant', content: '...'}]
  const { messages } = req.body; 

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    // 1. 呼叫 OpenAI，帶上 tools 定義
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 建議用 gpt-4o-mini 或 gpt-3.5-turbo (比較省錢且支援 tool call)
      messages: [
        {
          role: 'system',
          content: `你是一位專業的台灣旅遊助理。
          
          原則：
          1. 如果使用者只是在詢問資訊、聊天、或要求推薦但還沒確定要排入行程，請直接用文字回答，不要呼叫工具。
          2. 當使用者明確表示「幫我排行程」、「更新行程」、「把這個加入行程」時，請呼叫 'update_itinerary' 工具。
          3. 回答時語氣親切、有幫助。`
        },
        ...messages // 把前端傳來的歷史訊息都丟進去，這樣才有上下文
      ],
      tools: tools,
      tool_choice: 'auto', // 讓 AI 自己決定要不要用工具
    });

    const responseMessage = completion.choices[0].message;

    // 2. 判斷 AI 是否決定要呼叫工具 (Tool Call)
    if (responseMessage.tool_calls) {
      const toolCall = responseMessage.tool_calls[0];
      
      if (toolCall.function.name === 'update_itinerary') {
        // AI 決定要更新行程了！
        const itineraryArgs = JSON.parse(toolCall.function.arguments);
        
        console.log('AI 觸發行程更新:', itineraryArgs.summary);

        return res.json({
          role: 'assistant',
          content: `好的！已為您更新行程：${itineraryArgs.summary}`, // 這是給前端顯示的文字
          plan: itineraryArgs, // 這是給前端更新地圖的資料
        });
      }
    }

    // 3. 如果沒有呼叫工具，代表是普通聊天
    return res.json({
      role: 'assistant',
      content: responseMessage.content, // AI 的純文字回覆
      plan: null, // 不需要更新地圖
    });

  } catch (err) {
    console.error('OpenAI Error:', err);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

// ------------------ 其他 API 保持不變 ------------------

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});