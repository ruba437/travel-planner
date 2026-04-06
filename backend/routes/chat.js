const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const authMiddleware = require('../middleware/auth');

// 1. 初始化 OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
                      time: { 
                        type: 'string', 
                        description: '該行程的預估時間區間，請務必使用 24 小時制並以波浪號分隔 (例如 "09:30~11:30")。請根據景點特性預估合理的停留時間與交通時間。' 
                      },
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
router.post('/', async (req, res) => {
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

  const city = currentPlan?.city || '依據對話判斷';
  const daysCount = currentPlan?.days?.length ? `${currentPlan.days.length} 天` : '依據對話判斷';

  // 🔥 構建 System Prompt：調整為「主動型」助理
  let systemContent = `你是一位專業的全球旅遊行程規劃助理。今天是 ${today}。
    【目前的行程背景資訊】
    - 目的地：${city}
    - 旅遊天數：${daysCount} 天
    - 出發與日期資訊：(請參考使用者的第一句對話)

    【行程規劃標準作業程序 (SOP)】：
    系統已經透過前端介面獲取了上述的旅遊資訊，請依照以下最高指導原則進行對話與規劃：
    一、 對話與互動邏輯
    1. 【禁止確認已知資訊】：絕對不要再向使用者詢問「目的地在哪」、「去幾天」或「從哪裡出發/住宿地點」。
    2. 【大方給予推薦】：當使用者單純詢問「推薦美食」、「推薦住宿」、「交通方式」或「景點介紹」時，請發揮在地專家的精神，**直接用文字給出豐富、具體的推薦名單與詳細介紹**。絕對禁止回答「我無法推薦」或「我只能規劃行程」。
    3. 【保護現有行程 (⚠️極重要)】：在回答上述的「一般問答與推薦」時，**絕對不要呼叫 'update_itinerary' 工具**去覆蓋或修改使用者現有的行程！請單純用文字回覆即可。只有當使用者明確指示「請幫我把這些加入行程」或「幫我重新排行程」時，才可以使用工具。
    4. 【直接給予規劃】：當使用者明確說「幫我排行程」或要求生成完整路線時，請直接呼叫 'update_itinerary' 工具生成行程，不要拖泥帶水。

    二、 行程生成規則 (⚠️極重要，攸關系統運作⚠️)
    當你明確收到指令並呼叫 'update_itinerary' 工具時，必須嚴格遵守以下系統層級的限制：
    1. 【嚴格限制地理範圍】：所有安排的景點、餐廳與活動，必須嚴格位於「${city}」這個城市或其合理的周邊通勤範圍內。絕對禁止產生跨越極遠縣市的行程（例如：台北的行程絕對不能出現南投、高雄的景點）。請在加入清單前，務必確認該地點的真實地理位置。
    2. 【禁止生成交通與過渡節點】：前端系統具有「自動計算真實交通時間」的功能！行程清單 (items) 中 只能包含實際造訪的實體「景點」、「餐廳」或「店家」。
      - ❌ 絕對禁止產生：「搭乘捷運」、「步行前往」、「交通時間」、「回到住宿休息」、「自由活動」等非實體地點項目。
    3. 【停留時間設定】：請為每個實體景點評估合理的停留時間區間（格式為 "HH:mm~HH:mm"，例如 "09:30~11:30"）。
      - 評估基準：大型景點 2-3 小時、小型景點 1 小時、用餐 1.5 小時。
      - ⚠️ 注意：你只需要給出該景點的「停留時間」，絕對不需要在兩個景點之間手動預留交通空檔，系統會自己把後續時間往後推算。
    4. 【每日統一出發時間】：每一天的第一個景點，請一律預設從 "09:00" 開始安排（除非使用者明確要求其他時間）。`;

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

module.exports = router;