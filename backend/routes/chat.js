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
                      name: { type: 'string' },
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
                  description: '【禁令】：嚴禁與標題或描述內容重複。請填寫感性或氛圍類的標籤，如：#深度體驗 #不趕路 #攝影控首選' 
                },
                daySummaries: { 
                  type: 'array', 
                  items: { type: 'string' }, 
                  description: '每日具體地點大綱。⚠️禁止包含 Day X 或 第 X 天 字樣。' 
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

// ------------------ API: Chat Endpoint ------------------
router.post('/', async (req, res) => {
  const { messages, currentPlan } = req.body; 
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  const today = new Date().toISOString().split('T')[0];
  const city = currentPlan?.city || '依據對話判斷';
  // 🚀 獲取當前天數，用於在 System Prompt 中提醒 AI
  const daysCountText = (currentPlan?.days && currentPlan.days.length > 0)
    ? `${currentPlan.days.length} 天`
    : '依據對話判斷';

  let systemContent = `你是一位專業的全球旅遊規劃助理。今天是 ${today}。

    【兩階段規劃規範】
    1. 初步提案階段 (generate_proposals)：
      - 請提供 2-3 個方案。
      - 'daySummaries' 必須包含具體景點名稱（如：大英博物館、倫敦塔橋）。
      - ⚠️【格式禁令】：摘要中禁止包含 "Day X" 或 "第 X 天" 的字眼，直接描述景點即可。

    2. 詳細規劃階段 (update_itinerary)：
      - 當使用者選定後，才呼叫此工具產生完整的每日細節、座標與時間。

    3. 【Hashtag 規範】：
      - 'highlights' 陣列必須與 'title' 和 'description' 完全不同。
      - 不要放景點名稱在 Hashtag 裡（景點應放在 daySummaries）。
      - 範例：若標題是「雪梨文化之旅」，Hashtag 應為 #藝術巡禮 #歌劇院夜景 #文青必去，而非 #雪梨 #文化。

    【目前的行程背景】
    - 目的地：${city}
    - 旅遊天數：${daysCountText}

    【行程生成規則】
    - items[].name 只能是地點名稱。
    - 停留時間格式固定為 "HH:mm~HH:mm"。
    - 預設首日 09:00 出發。
    - 必須根據當地真實物價給予 cost 數值 (幣別：${currentPlan?.currency || '自動判定'})。`;

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
        try {
          enrichedPlan = await enrichItineraryImages(args);
        } catch (e) { console.warn('Images failed', e); }

        return res.json({
          role: 'assistant',
          content: `好的！這是我為您詳細規劃的「${enrichedPlan.summary}」行程。`,
          plan: enrichedPlan,
        });
      }
      
      if (toolCall.function.name === 'generate_proposals') {
        return res.json({
          role: 'assistant',
          content: '我已經為您準備了幾個方案，選定後我會為您生成多天的詳細內容。',
          proposals: args.proposals,
        });
      }
    }

    return res.json({ role: 'assistant', content: responseMessage.content, plan: null });

  } catch (err) {
    console.error('OpenAI Error:', err);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

module.exports = router;