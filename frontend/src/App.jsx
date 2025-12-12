// frontend/src/App.jsx
import { useState } from 'react';
import './App.css';
import MapView from './MapView';

function App() {
  const [messages, setMessages] = useState([
    { role: 'system', text: '嗨，我是旅遊小助手，試著輸入你的旅遊需求吧！' },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [plan, setPlan] = useState(null); // 用來存後端回傳的行程 JSON
  const [activeLocation, setActiveLocation] = useState(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const newMessages = [...messages, { role: 'user', text }];
    setMessages(newMessages);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      const assistantText =
        data.reply ||
        (data.plan?.summary
          ? data.plan.summary
          : '已產生行程，請看右側行程預覽。');

      setMessages([...newMessages, { role: 'assistant', text: assistantText }]);

      if (data.plan) {
        setPlan(data.plan);
      }
    } catch (err) {
      console.error(err);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          text: '後端連線失敗，請確認 server 有沒有啟動。',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 小工具：把 time/type 轉成比較好看的中文
  const displayTime = (time) => {
    switch (time) {
      case 'morning':
        return '早上';
      case 'noon':
        return '中午';
      case 'afternoon':
        return '下午';
      case 'evening':
        return '傍晚';
      case 'night':
        return '晚上';
      default:
        return time;
    }
  };

  const displayType = (type) => {
    switch (type) {
      case 'sight':
        return '景點';
      case 'food':
        return '美食';
      case 'shopping':
        return '購物';
      case 'activity':
        return '活動';
      default:
        return type;
    }
  };

  return (
    <div className="app-root">
      <div className="app-shell">
        {/* Header */}
        <div className="app-header">
          <div className="app-header-title">
            <span className="logo-dot" />
            旅遊聊天小助手 · 行程展示版
          </div>
          <div className="app-header-subtitle">
            試著輸入：「幫我安排台中兩天一夜行程，預算一萬，想吃美食跟看夜景」看看效果！
          </div>
        </div>

        {/* 左聊右展示 */}
        <div className="main-layout">
          {/* 左邊：聊天區 */}
          <div className="chat-panel">
            <div className="chat-messages">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={
                    'chat-row ' +
                    (m.role === 'user'
                      ? 'user'
                      : m.role === 'assistant'
                      ? 'assistant'
                      : 'system')
                  }
                >
                  <div
                    className={
                      'bubble ' +
                      (m.role === 'user'
                        ? 'bubble-user'
                        : m.role === 'assistant'
                        ? 'bubble-assistant'
                        : 'bubble-system')
                    }
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* 輸入框 */}
            <div className="chat-input-area">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="輸入你的旅遊需求，例如：幫我安排台中兩天一夜行程..."
                className="chat-textarea"
              />
              <button
                onClick={handleSend}
                disabled={isSending}
                className="send-button"
              >
                {isSending ? '傳送中…' : '送出'}
              </button>
            </div>
          </div>

          {/* 右邊：地圖 + 行程預覽 */}
          
            {/* 地圖卡片 */}
            <div className="card map-card">
              <div className="card-header">
                <span className="dot" />
                行程地圖
              </div>
              <MapView 
                plan={plan} 
                activeLocation={activeLocation}        
                onLocationChange={setActiveLocation}   
              />
            </div>

            {/* 行程卡片 */}
            <div className="card plan-card">
              <div className="card-header">
                <span className="dot" />
                行程預覽
              </div>

              {plan ? (
                <div style={{ fontSize: '13px' }}>
                  <div className="plan-summary">
                    <div>
                      <strong>城市：</strong>
                      {plan.city || '（未指定）'}
                    </div>
                    <div>
                      <strong>概要：</strong>
                      {plan.summary || '（無概要）'}
                    </div>
                  </div>

              {(plan.days || []).map((day) => {
                const dayNumber = Number(day.day);

                return (
                  <div key={day.day} className="plan-day-block">
                    <div className="plan-day-title">
                      第 {day.day} 天 · {day.title || '未命名主題'}
                    </div>
                    <ul className="plan-item-list">
                      {(day.items || []).map((item, idx) => {
                        const isActive =
                          activeLocation &&
                          Number(activeLocation.day) === dayNumber &&
                          Number(activeLocation.order) === idx;

                        return (
                          <li
                            key={idx}
                            className={
                              'plan-item' + (isActive ? ' plan-item-active' : '')
                            }
                            // 🟢 點列表 → 通知 MapView：第幾天 / 當天第幾個
                            onClick={() =>
                              setActiveLocation({ day: dayNumber, order: idx })
                            }
                          >
                            <div className="plan-item-main">
                              <strong>{displayTime(item.time)}：</strong>
                              {item.name}{' '}
                              <span className="plan-item-type">
                                ({displayType(item.type)})
                              </span>
                            </div>
                            {item.note && (
                              <div className="plan-item-note">{item.note}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}

                </div>
              ) : (
                <div className="plan-empty-text">
                  尚未產生行程，請在左邊輸入你的旅遊需求。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    
  );
}

export default App;
