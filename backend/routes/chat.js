const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const authMiddleware = require('../middleware/auth');

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
          summary: { type: 'string', description: '行程概要' },
          city: { type: 'string', description: '目的地城市' },
          totalBudget: { type: 'number', description: '建議預算' },
          days: { 
            type: 'array', 
            items: { 
              type: 'object',
              properties: {
                day: { type: 'number' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      time: { type: 'string', description: '時段 (如 09:00~11:00)' },
                      name: { type: 'string' },
                      type: { type: 'string', enum: ['sight', 'food', 'shopping', 'activity'] },
                      cost: { type: 'number' },
                      note: { type: 'string' }
                    },
                    required: ['time', 'name', 'type', 'cost']
                  }
                }
              }
            } 
          }
        },
        required: ['summary', 'city', 'days'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_proposals',
      description: '產生 2-3 個行程提案。每個提案必須包含基礎的 itineraryData 物件，即使裡面只有城市名稱。',
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
                description: { type: 'string' },
                highlights: { type: 'array', items: { type: 'string' } },
                // 🚀 強制要求此物件存在
                itineraryData: { 
                  type: 'object', 
                  properties: {
                    city: { type: 'string' },
                    summary: { type: 'string' }
                  },
                  required: ['city'] 
                }
              },
              required: ['id', 'title', 'description', 'highlights', 'itineraryData'] // 🚀 設為必填
            }
          }
        },
        required: ['proposals'],
      },
    },
  }
];

// ------------------ API: Chat Endpoint ------------------
router.post('/', async (req, res) => {
  const { messages, currentPlan } = req.body; 
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  const today = new Date().toISOString().split('T')[0];
  const city = currentPlan?.city || '依據對話判斷';

  let systemContent = `你是一位專業的全球旅遊規劃助理。今天是 ${today}。

    【兩階段規劃流程】
    1. 初步提案階段 (generate_proposals)：
       - 當使用者提出客製化需求時，請提供 2-3 個風格迥異的提案。
       - 此階段「不需要」產出詳細的景點清單，只需標題、描述與亮點。
       - 這是為了讓使用者先進行「比較與選定」。

    2. 詳細規劃階段 (update_itinerary)：
       - 當使用者說「選定某方案」、「就這個」或點擊預覽詳細行程時。
       - 你必須針對該方案擴充為「完整的每日行程」。
       - 必須包含具體的時間(time)、景點(name)與花費(cost)。
       - 隨性模式下，時間可填寫「上午/下午」。

    【目前的背景資訊】目的地：${city}`;

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

      if (toolCall.function.name === 'generate_proposals') {
        return res.json({
          role: 'assistant',
          content: '我已經根據您的需求準備了幾個不同的方案，您可以先預覽大綱，選定後我會為您生成詳細內容。',
          proposals: args.proposals,
        });
      }

      if (toolCall.function.name === 'update_itinerary') {
        return res.json({
          role: 'assistant',
          content: `好的！這是我為您詳細規劃的「${args.summary}」行程。`,
          plan: args,
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