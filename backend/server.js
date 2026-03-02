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
  const { messages, currentPlan } = req.body; 
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  const today = new Date().toISOString().split('T')[0];

  // 🔥 構建 System Prompt：調整為「主動型」助理
  let systemContent = `你是一位專業的全球旅遊行程規劃助理。今天是 ${today}。
          
  【核心原則 - 請嚴格遵守】：
  1. **🚀 主動生成行程 (Trigger)**：
      - 當使用者提供**「地點」**與**「天數」**意圖時 (例如：「我想去東京五天」、「幫我安排台北一日遊」)，請**直接呼叫 'update_itinerary' 工具**生成一份完整的初始行程。
      - **不需要**先回覆文字詢問「需要我幫你排嗎？」，請直接生成。
  
  2. **純諮詢 (Consultation)**：
      - 只有當使用者單純詢問「推薦」、「天氣如何」、「好玩嗎」且**沒有**提到具體天數規劃時，才只回覆文字建議。
  
  3. **🔧 行程修改 (Modification)**：
      - 如果下方提供了【目前已有的行程資料】，當使用者要求「新增」或「修改」時，**請務必保留原本行程中未被修改的部分**。
      - ❌ **絕對禁止**回傳一個只包含新項目的空行程。
      - 請將新項目插入到合適的時間點，並透過工具回傳【舊行程 + 新項目】的完整 JSON。

  4. **地理資訊**：
      - 城市名稱若為國外，請加上國家前綴 (例如: "日本東京")。
      - 如果使用者有提到日期，請計算正確的 YYYY-MM-DD。`;

  // 注入記憶
  if (currentPlan) {
    systemContent += `
    
    --------------------------------------------------
    【⚠️ 目前已有的行程資料 (Current Itinerary)】
    以下是使用者目前的行程表，請基於此資料進行修改，不要刪除既有內容：
    ${JSON.stringify(currentPlan)}
    --------------------------------------------------
    `;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages: [
        { role: 'system', content: systemContent },
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
          content: `沒問題！已為您生成行程：${itineraryArgs.summary} ${itineraryArgs.startDate ? `(出發日: ${itineraryArgs.startDate})` : ''}，您可以再告訴我需要調整哪裡。`,
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

// 其他 API 保持不變 (Health, Search, Details, Photo, Directions, Weather)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/places/search', async (req, res) => {
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

app.get('/api/place-details', async (req, res) => {
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
  } catch (err) { res.status(500).send('Failed'); }
});

app.post('/api/directions', async (req, res) => {
  const { origin, destination, mode } = req.body || {};
  if (!origin || !destination) return res.status(400).json({ error: 'Missing params' });
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: `${origin.lat},${origin.lng}`, destination: `${destination.lat},${destination.lng}`,
        mode: (mode || 'TRANSIT').toLowerCase(), language: 'zh-TW', key: process.env.GOOGLE_DIRECTIONS_API_KEY || process.env.GOOGLE_PLACES_API_KEY,
      },
    });
    const route = response.data.routes[0];
    const leg = route?.legs[0];
    if (!leg) return res.status(400).json({ error: 'No route' });
    res.json({
      summary: {
        distanceText: leg.distance?.text, durationText: leg.duration?.text,
        steps: (leg.steps || []).map((s) => ({
          instructionHtml: s.html_instructions, distanceText: s.distance?.text, durationText: s.duration?.text, travelMode: s.travel_mode,
        })),
      },
      encodedPolyline: route.overview_polyline?.points, bounds: route.bounds,
    });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/weather', async (req, res) => {
  const { city, startDate } = req.body;
  if (!city || !startDate) return res.status(400).json({ error: 'Missing' });
  try {
    const start = new Date(startDate);
    const now = new Date();
    const diffDays = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    if (diffDays > 14) return res.json({ daily: null, reason: 'Date too far' });
    const placeRes = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', { params: { query: city, key: process.env.GOOGLE_PLACES_API_KEY, language: 'zh-TW' } });
    const location = placeRes.data.results?.[0]?.geometry?.location;
    if (!location) return res.status(404).json({ error: 'City not found' });
    const endDate = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const weatherRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: { latitude: location.lat, longitude: location.lng, daily: 'weathercode,temperature_2m_max,temperature_2m_min', timezone: 'auto', start_date: startDate, end_date: endDate }
    });
    res.json({ daily: weatherRes.data.daily });
  } catch (err) { res.json({ daily: null }); }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
});
