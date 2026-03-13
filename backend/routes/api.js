// backend/routes/api.js
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const axios = require('axios');
const crypto = require('crypto');
const pool = require('../db');

// 所有 API 啟動前查看auth是否通過
const authMiddleware = require('../middleware/auth');

// 照片不需要 auth（<img> 無法帶 header）
router.get('/places/photo', async (req, res) => {
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

// 以下路由都需要登入
router.use(authMiddleware);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ------------------ 定義工具 (Tools) ------------------
const tools = [
  {
    type: 'function',
    function: {
      name: 'update_itinerary',
      description: '【僅在確認起點與時間後呼叫】生成包含起點與出發時間的完整旅遊行程。',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '行程的簡短中文概要' },
          totalBudget: { 
            type: "number", 
            description: "根據行程預估的總花費建議，或使用者要求的預算上限" 
          },
          city: { 
            type: 'string', 
            description: '旅遊目的地城市。⚠️重要：若為國外城市，請務必包含國家名稱 (例如: "義大利威尼斯")。' 
          },
          startDate: { 
            type: 'string', 
            description: '旅遊開始日期，格式為 YYYY-MM-DD。' 
          },
          startLocation: { 
            type: 'string', 
            description: '行程第一天的出發起點（例如：飯店名稱、機場或車站）' 
          },
          startTime: { 
            type: 'string', 
            description: '第一天開始行程的時間，格式為 HH:mm (例如 "09:00")' 
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
                      cost: { 
                        type: "number", 
                        description: "該項目的預估花費（以當地貨幣或美金估算，僅數字）" 
                      }
                    },
                    required: ['time', 'name', 'type', "cost"],
                  },
                },
              },
              required: ['day', 'items'],
            },
          },
        },
        required: ['summary', 'city', 'days', 'startLocation', 'startTime'],
      },
    },
  },
];

// ------------------ API: Chat Endpoint ------------------
router.post('/chat', async (req, res) => {
  const systemMsg = {
    role: 'system',
    content: `你是一個旅遊助手。當使用者提及預算限制（例如：我的預算是兩萬）或要求行程時：
    1. 請估算各項活動 cost。
    2. 請在 update_itinerary 的 totalBudget 欄位填入：
      - 若使用者有指定預算，則填入該金額。
      - 若使用者沒指定，則填入你估算完所有活動後的總和加 10% 作為緩衝。`
  };
  const { messages, currentPlan } = req.body; 
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  const today = new Date().toISOString().split('T')[0];

  // 🔥 構建 System Prompt：調整為「主動型」助理
  let systemContent = `你是一位專業的全球旅遊行程規劃助理。今天是 ${today}。
【標準作業程序 (SOP)】：
1. **檢查必要資訊**：當使用者想規劃行程時，你必須確認擁有以下資訊：
   - 目的地城市
   - 旅遊天數
   - **起始地點 (例如：機場、飯店、車站)**
   - **第一天的出發時間 (例如：09:00)**

2. **缺少資訊時的處理**：
   - 如果使用者提供了「地點」和「天數」，但**沒提到**「起點」或「時間」，請**不要**呼叫 'update_itinerary'。
   - 請用親切的語氣回覆：「沒問題！我可以幫您安排[地點]的[天數]行程。為了更精準規劃交通，請問您第一天的**出發地點**是哪裡？以及預計幾點**開始行程**呢？」

3. **資訊齊全時的處理**：
   - 只有當上述四項資訊都明確（或使用者在對話中補齊）時，才呼叫 'update_itinerary' 生成完整 JSON。

4. **預設值處理**：
   - 如果使用者回答「隨便」、「你決定」、「不用管起點」，此時再使用預設值（例如：台北車站、09:00）並呼叫工具。`;

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
        const reply = `沒問題！已為您規劃從 **${itineraryArgs.startLocation}** 於 **${itineraryArgs.startTime}** 出發的行程。`;
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

router.post('/places/search', async (req, res) => {
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

router.get('/place-details', async (req, res) => {
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

router.post('/weather', async (req, res) => {
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

// ------------------ 行程 CRUD ------------------
router.get('/itineraries', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT uuid, title, summary, city, startdate, createdat, updatedat FROM itineraries WHERE userid = $1 ORDER BY updatedat DESC',
      [req.user.id]
    );
    res.json({ itineraries: rows });
  } catch (err) {
    console.error('Get itineraries error:', err);
    res.status(500).json({ error: '取得行程列表失敗' });
  }
});

router.post('/itineraries', async (req, res) => {
  const { title, summary, city, startDate, itineraryData } = req.body;
  if (!itineraryData) return res.status(400).json({ error: '行程資料不可為空' });
  const uuid = crypto.randomUUID();
  try {
    const { rows } = await pool.query(
      `INSERT INTO itineraries (userid, uuid, title, summary, city, startdate, itinerarydata)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING uuid, createdat`,
      [req.user.id, uuid, title || '', summary || '', city || '', startDate || null, JSON.stringify(itineraryData)]
    );
    res.status(201).json({ uuid: rows[0].uuid, createdAt: rows[0].createdat });
  } catch (err) {
    console.error('Create itinerary error:', err);
    res.status(500).json({ error: '保存行程失敗' });
  }
});

router.get('/itineraries/:uuid', async (req, res) => {
  const { uuid } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM itineraries WHERE uuid = $1',
      [uuid]
    );
    if (rows.length === 0) return res.status(404).json({ error: '行程不存在' });
    const row = rows[0];
    let itineraryData;
    try { itineraryData = JSON.parse(row.itinerarydata); } catch { itineraryData = null; }
    res.json({ uuid: row.uuid, title: row.title, summary: row.summary, city: row.city, startDate: row.startdate, itineraryData, createdAt: row.createdat, updatedAt: row.updatedat });
    
  } catch (err) {
    console.error('Get itinerary error:', err);
    res.status(500).json({ error: '取得行程失敗' });
  }
});

router.put('/itineraries/:uuid', async (req, res) => {
  const { uuid } = req.params;
  const { title, summary, city, startDate, itineraryData } = req.body;
  if (!itineraryData) return res.status(400).json({ error: '行程資料不可為空' });
  try {
    const { rowCount } = await pool.query(
      `UPDATE itineraries SET title = $1, summary = $2, city = $3, startdate = $4, itinerarydata = $5, updatedat = CURRENT_TIMESTAMP
       WHERE uuid = $6 AND userid = $7`,
      [title || '', summary || '', city || '', startDate || null, JSON.stringify(itineraryData), uuid, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: '行程不存在或無權限' });
    res.json({ success: true });
  } catch (err) {
    console.error('Update itinerary error:', err);
    res.status(500).json({ error: '更新行程失敗' });
  }
});

router.delete('/itineraries/:uuid', async (req, res) => {
  const { uuid } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM itineraries WHERE uuid = $1 AND userid = $2',
      [uuid, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: '行程不存在或無權限' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete itinerary error:', err);
    res.status(500).json({ error: '刪除行程失敗' });
  }
});

// 其他 API
router.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = router;
