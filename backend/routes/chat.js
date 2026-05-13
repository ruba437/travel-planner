// backend/routes/chat.js
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
      // 🆕 修改：在描述中加上地理與連續性的強調
      description: '【詳細規劃階段】生成包含每日時段、具體地點、座標與花費的完整 JSON。⚠️注意：所有地點必須嚴格限制在「單一具體城市」內。當使用者選定某個方案或要求詳細行程時呼叫。',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '行程的簡短繁體中文概要' },
          currency: { type: 'string', description: '標準 ISO 4217 三碼字串（例如 "JPY", "TWD"）。' },
          totalBudget: { type: "number", description: "預估總花費" },
          city: { type: 'string', description: '單一具體的目的地城市（例如："台北市", "京都市", "巴黎"）。⚠️嚴禁僅填寫國家名稱。' },
          startDate: { type: 'string', description: 'YYYY-MM-DD' },
          startTime: { type: 'string', description: 'HH:mm (例如 "09:00")' },
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
                      time: { type: 'string', description: '24小時制波浪號分隔 (例如 "09:30~11:30")' },
                      name: { type: 'string', description: '地點名稱。⚠️禁止與同日內重複。' },
                      type: { type: 'string', enum: ['sight', 'food', 'shopping', 'activity'] },
                      note: { type: 'string' },
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
      description: '【初步提案階段】產生 3 個風格大綱。此階段「禁止」產出詳細 items 地點清單。',
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
                description: { type: 'string', description: '方案風格與價值的中文描述。' },
                highlights: { 
                  type: 'array', 
                  items: { type: 'string' }, 
                  description: '氛圍標籤，嚴禁與標題重複。' 
                },
                daySummaries: { 
                  type: 'array', 
                  items: { type: 'string' }, 
                  description: '每日一句話摘要。⚠️禁止包含 "Day X" 字樣。' 
                },
                itineraryData: { 
                  type: 'object', 
                  properties: { city: { type: 'string' } },
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
  const city = (currentPlan?.city && currentPlan.city.trim() !== '') ? currentPlan.city : '未決定';
  
  // 🛡️ 強化版天數偵測 (避免出現 null)
  let expectedDays = (currentPlan?.days && currentPlan.days.length > 0) ? currentPlan.days.length : null;
  
  if (!expectedDays) {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || "";
    const match = lastUserMsg.match(/(\d+)\s*天/);
    if (match) {
      expectedDays = parseInt(match[1]);
    } else {
      const fullText = messages.map(m => m.content).join(" ");
      const globalMatch = fullText.match(/(\d+)\s*天/);
      if (globalMatch) expectedDays = parseInt(globalMatch[1]);
    }
  }

  const displayDays = expectedDays || "多";
  const daysCountText = expectedDays ? `${expectedDays} 天` : '依據對話判斷';

  let systemContent = `你是一位專業的全球旅遊規劃助理。今天是 ${today}。

    【語言規範：繁體中文】
    - ⚠️ 你必須「全程使用繁體中文」回答。

    【互動與流程邏輯】
    你具有三種回應模式，請務必依據使用者的對話意圖，選擇最適合的模式：
    1. 🗣️ 一般對話 (不呼叫工具)：
       - 觸發時機：使用者「明確」針對某個細節提問、閒聊，或是針對現有行程提出單一修改討論。
    2. 💡 方案提案 (generate_proposals)：
       - 觸發時機：使用者要求規劃全新行程、換城市，或「尚未決定目的地」時呼叫。
       - ⚠️【強制提案規則】：如果系統紀錄的目的地是「未決定」，你「必須立刻」呼叫此工具提供 3 個不同城市的提案，**絕對禁止反問使用者想去哪裡或要求更多偏好**。請直接根據你專業的判斷，給出 3 個特色迥異的城市選擇！
       - 提供 3 個方案大綱，'daySummaries' 長度必須精確等於 ${displayDays}。
    3. 📅 詳細規劃 (update_itinerary)：
       - 觸發時機：當使用者明確選定方案後呼叫。
       - 'days' 陣列長度必須「精確等於」${displayDays} 天。

    【目的地與硬性規則】
    - 系統目前紀錄的目的地：${city === '未決定' ? '未決定（⚠️請立刻推薦3個不同城市，嚴禁反問任何問題）' : city} | 天數：${daysCountText}。
    - 🔄【動態變更目的地機制】：如果使用者在對話中明確表示要換城市或換國家，你必須優先遵從使用者的最新指令。
    - ⚠️【單一城市與連續性限制】：單一行程必須「嚴格限制在單一具體城市內」。如果使用者只說了國家，請自動挑選該國最適合的一個主要城市。
    - 每天路線必須具備地理連續性。地點嚴禁重複。`;

  if (currentPlan) {
    systemContent += `\n【⚠️ 目前已有的行程資料背景】\n${JSON.stringify(currentPlan)}`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages: [{ role: 'system', content: systemContent }, ...messages],
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.3, 
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.tool_calls) {
      const toolCall = responseMessage.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);

      if (toolCall.function.name === 'update_itinerary') {
        let enrichedPlan = args;
        
        if (expectedDays && enrichedPlan.days && enrichedPlan.days.length > expectedDays) {
          enrichedPlan.days = enrichedPlan.days.slice(0, expectedDays);
        }

        try { enrichedPlan = await enrichItineraryImages(args); } catch (e) {}
        
        return res.json({ 
          role: 'assistant', 
          content: `好的！這是我為您詳細規劃的 ${displayDays} 天行程。`, 
          plan: enrichedPlan 
        });
      }
      
      if (toolCall.function.name === 'generate_proposals') {
        if (expectedDays) {
          args.proposals = args.proposals.map(p => ({
            ...p,
            daySummaries: p.daySummaries.slice(0, expectedDays)
          }));
        }
        return res.json({ 
          role: 'assistant', 
          content: `我為您準備了 3 個提案：`, 
          proposals: args.proposals 
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