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
            description: '根據使用者要求的旅遊目的地，自動判定當地的通用貨幣，並回傳標準的 ISO 4217 三碼字串（例如去日本請回傳 "JPY"，去韓國回傳 "KRW"，去台灣回傳 "TWD"，去美國回傳 "USD" 等）。' 
          },
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
                startLocation: {
                  type: 'string',
                  description: '該日出發起點（例如：飯店名稱、機場或車站）'
                },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      time: { 
                        type: 'string', 
                        description: '該行程的預估時間區間，請務必使用 24 小時制並以波浪號分隔 (例如 "09:30~11:30")。請根據景點特性預估合理的停留時間與交通時間。' 
                      },
                      name: { type: 'string', description: '地點的具體名稱，只能放地名，不要放完整敘述或時間資訊' },
                      type: { type: 'string', enum: ['sight', 'food', 'shopping', 'activity'] },
                      note: { type: 'string' },
                      placeId: { type: 'string', description: 'Google Places place_id，若已知請一併填寫' },
                      address: { type: 'string', description: '地點地址，若已知請一併填寫' },
                      lat: { type: 'number', description: '地點緯度，若已知請一併填寫' },
                      lng: { type: 'number', description: '地點經度，若已知請一併填寫' },
                      cost: { 
                        type: "number", 
                        description: "該項目的預估花費（以當地貨幣估算，僅數字）。【極度重要：當地物價數量級】所有的 cost 必須嚴格使用你判定的 currency（當地貨幣）的真實物價水準來估算！絕不可使用美金 (USD) 的數字直接套用。參考基準：如果是 JPY (日圓)：一般小吃/簡餐約 1000~2000，正式餐廳 3000~5000，景點門票約 1500~3000。如果是 KRW (韓元)：一般簡餐約 10000~15000，咖啡廳約 5000~8000。如果是 TWD (台幣)：一般小吃約 100~200，餐廳約 500~1000。免費景點（如公園、走路逛街）請嚴格填寫 0。請確保生成的數字符合當地的真實生活成本！" 
                      }
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
  const daysCountText = Array.isArray(currentPlan?.days) && currentPlan.days.length > 0
    ? `${currentPlan.days.length} 天`
    : '依據對話判斷';

  let systemContent = `你是一位專業的全球旅遊規劃助理。今天是 ${today}。

    【貨幣判定規則】：請根據使用者要求的旅遊目的地，自動判定當地的通用貨幣，並在 "currency" 欄位中回傳標準的 ISO 4217 三碼字串（例如去日本請回傳 "JPY"，去韓國回傳 "KRW"，去台灣回傳 "TWD"，去美國回傳 "USD" 等）。

    【目前的行程背景資訊】
    - 目的地：${city}
    - 旅遊天數：${daysCountText}
    - 出發與日期資訊：(請參考使用者的第一句對話)
    
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

    【行程規劃標準作業程序 (SOP)】：
    系統已經透過前端介面獲取了上述的旅遊資訊，請依照以下最高指導原則進行對話與規劃：
    一、 對話與互動邏輯
    1. 【禁止確認已知資訊】：絕對不要再向使用者詢問「目的地在哪」、「去幾天」或「從哪裡出發/住宿地點」。
    2. 【大方給予推薦】：當使用者單純詢問「推薦美食」、「推薦住宿」、「交通方式」或「景點介紹」時，請發揮在地專家的精神，**直接用文字給出豐富、具體的推薦名單與詳細介紹**。絕對禁止回答「我無法推薦」或「我只能規劃行程」。
    3. 【保護現有行程 (⚠️極重要)】：在回答上述的「一般問答與推薦」時，**絕對不要呼叫 'update_itinerary' 工具**去覆蓋或修改使用者現有的行程！請單純用文字回覆即可。只有當使用者明確指示「請幫我把這些加入行程」或「幫我重新排行程」時，才可以使用工具。
    4. 【直接給予規劃】：當使用者明確說「幫我排行程」或要求生成完整路線時，請直接呼叫 'update_itinerary' 工具生成行程，不要拖泥帶水。
    5. 【欄位格式約束】：items[].name 只能寫單一地點名稱，不能寫成一整段描述、建議或時間說明；若需要補充說明，請放到 note。若你知道地點資訊，請盡量同時填入 placeId、address、lat、lng，不要把這些資訊混進 name。

    二、 行程生成規則 (⚠️極重要，攸關系統運作⚠️)
    當你明確收到指令並呼叫 'update_itinerary' 工具時，必須嚴格遵守以下系統層級的限制：
    1. 【嚴格限制地理範圍】：所有安排的景點、餐廳與活動，必須嚴格位於「${city}」這個城市或其合理的周邊通勤範圍內。絕對禁止產生跨越極遠縣市的行程（例如：台北的行程絕對不能出現南投、高雄的景點）。請在加入清單前，務必確認該地點的真實地理位置。
    2. 【禁止生成交通與過渡節點】：前端系統具有「自動計算真實交通時間」的功能！行程清單 (items) 中 只能包含實際造訪的實體「景點」、「餐廳」或「店家」。
      - ❌ 絕對禁止產生：「搭乘捷運」、「步行前往」、「交通時間」、「回到住宿休息」、「自由活動」等非實體地點項目。
    3. 【停留時間設定】：請為每個實體景點評估合理的停留時間區間（格式為 "HH:mm~HH:mm"，例如 "09:30~11:30"）。
      - 評估基準：大型景點 2-3 小時、小型景點 1 小時、用餐 1.5 小時。
      - ⚠️ 注意：你只需要給出該景點的「停留時間」，絕對不需要在兩個景點之間手動預留交通空檔，系統會自己把後續時間往後推算。
    4. 【每日起始位置】(可選)：如果有明確的出發起點（例如飯店、機場或車站），可在 days[].startLocation 填寫；若無特定起點，可留空讓使用者自行設定。
    5. 【每日統一出發時間】：每一天的第一個景點，請一律預設從 "09:00" 開始安排（除非使用者明確要求其他時間）。`;

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
      messages: [{ role: 'system', content: systemContent }, ...messages],
      tools: tools,
      tool_choice: 'auto',
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.tool_calls) {
      const toolCall = responseMessage.tool_calls[0];
      const itineraryArgs = JSON.parse(toolCall.function.arguments);
      if (toolCall.function.name === 'update_itinerary') {
        let enrichedPlan = itineraryArgs;
        try {
          enrichedPlan = await enrichItineraryImages(itineraryArgs);
        } catch (error) {
          console.warn('Itinerary image enrichment failed:', error.message || error);
        }

        return res.json({
          role: 'assistant',
          content: `好的！這是我為您詳細規劃的「${enrichedPlan.summary}」行程。`,
          plan: enrichedPlan,
        });
      }
      
      if (toolCall.function.name === 'generate_proposals') {
        return res.json({
          role: 'assistant',
          content: '我已經根據您的需求準備了幾個不同的方案，您可以先預覽大綱，選定後我會為您生成詳細內容。',
          proposals: itineraryArgs.proposals,
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