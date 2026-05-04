const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const authMiddleware = require('../middleware/auth');
const { enrichItineraryImages } = require('../utils/itineraryImages');

// 1. 初始化 OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. 定義 AI 工具
const tools = [
  {
    type: 'function',
    function: {
      name: 'update_itinerary',
      description: '【詳細規劃階段】當使用者選定方案或要求詳細行程時呼叫。生成包含每日時段、景點名稱、座標與花費的完整 JSON。',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '行程的簡短中文概要' },
          currency: { 
            type: 'string', 
            description: '標準 ISO 4217 三碼字串（例如 "JPY", "TWD"）。' 
          },
          totalBudget: { type: "number", description: "預估總花費" },
          city: { type: 'string', description: '目的地城市（含國家）' },
          startDate: { type: 'string', description: 'YYYY-MM-DD' },
          startTime: { type: 'string', description: 'HH:mm (例如 "09:00")' },
          days: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'number' },
                title: { type: 'string' },
                startLocation: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      time: { type: 'string', description: '24小時制波浪號分隔 (例如 "09:30~11:30")' },
                      name: { type: 'string', description: '地點名稱。⚠️禁止與同日內其他地點重複。' },
                      type: { type: 'string', enum: ['sight', 'food', 'shopping', 'activity'] },
                      note: { type: 'string' },
                      placeId: { type: 'string' },
                      address: { type: 'string' },
                      lat: { type: 'number' },
                      lng: { type: 'number' },
                      cost: { type: "number" }
                    },
                    required: ['time', 'name', 'type', 'cost']
                  }
                }
              }
            } 
          }
        },
        required: ['summary', 'currency', 'city', 'days', 'startTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_proposals',
      description: '【初步提案階段】當使用者提出需求時，產生 2-3 個風格迥異的方案大綱。必須包含每一天的標題。',
      parameters: {
        type: 'object',
        properties: {
          proposals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string', description: '方案的核心價值與風格描述。' },
                highlights: { 
                  type: 'array', 
                  items: { type: 'string' }, 
                  description: '【禁令】：嚴禁與標題或描述內容重複。' 
                },
                daySummaries: { 
                  type: 'array', 
                  items: { type: 'string' }, 
                  description: '每日地點大綱。⚠️禁止包含 Day X 或 第 X 天 字樣，必須包含具體景點名。' 
                },
                itineraryData: { 
                  type: 'object', 
                  properties: {
                    city: { type: 'string' },
                    summary: { type: 'string' }
                  },
                  required: ['city'] 
                }
              },
              required: ['id', 'title', 'description', 'highlights', 'daySummaries', 'itineraryData']
            }
          }
        },
        required: ['proposals'],
      },
    },
  },
];

router.post('/', async (req, res) => {
  const { messages, currentPlan } = req.body; 
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  const today = new Date().toISOString().split('T')[0];
  const city = currentPlan?.city || '依據對話判斷';
  const daysCountText = (currentPlan?.days && currentPlan.days.length > 0)
    ? `${currentPlan.days.length} 天`
    : '依據對話判斷';

  let systemContent = `你是一位專業的全球旅遊規劃助理。今天是 ${today}。

    【兩階段規劃規範】
    1. 初步提案階段 (generate_proposals)：
       - 提供 2-3 個方案。'daySummaries' 必須包含具體景點。
       - ⚠️【格式禁令】：摘要禁止包含 "Day X" 或 "第 X 天"。
    2. 詳細規劃階段 (update_itinerary)：
       - 選定後生成完整 JSON。
    3. 【Hashtag 規範】：
       - 嚴禁與標題或描述重複。不要放景點名稱在 Hashtag。

    【目前的行程背景】
    - 目的地：${city} | 旅遊天數：${daysCountText}

    【行程生成規則 (⚠️多樣性與去重要求⚠️)】
    1. 【禁止重複】：同一天 items[].name 絕對禁止重複。同點活動請合併至 note。
    2. 【豐富度】：每天至少包含 3 個以上不同實體地點。避免全天待在單一商場。
    3. 【規則】：停留時間固定為 "HH:mm~HH:mm"，首日 09:00 出發，使用當地真實物價。`;

  if (currentPlan) {
    systemContent += `\n【⚠️ 目前已有的行程資料】\n${JSON.stringify(currentPlan)}`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages: [{ role: 'system', content: systemContent }, ...messages],
      tools: tools,
      tool_choice: 'auto',
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.tool_calls) {
      const toolCall = responseMessage.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);

      if (toolCall.function.name === 'update_itinerary') {
        let enrichedPlan = args;
        try { enrichedPlan = await enrichItineraryImages(args); } catch (e) {}
        return res.json({ role: 'assistant', content: `已規劃行程：${enrichedPlan.summary}`, plan: enrichedPlan });
      }
      
      if (toolCall.function.name === 'generate_proposals') {
        return res.json({ role: 'assistant', content: '為您準備了以下方案：', proposals: args.proposals });
      }
    }

    return res.json({ role: 'assistant', content: responseMessage.content, plan: null });
  } catch (err) {
    console.error('OpenAI Error:', err);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

module.exports = router;