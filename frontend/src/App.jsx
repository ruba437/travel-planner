// frontend/src/App.jsx
import { useState } from 'react';
import './App.css';
import MapView from './MapView';

function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '嗨，我是旅遊小助手！我們可以先聊聊你想去哪裡、喜歡吃什麼，確定後我再幫你生成行程地圖。' },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [plan, setPlan] = useState(null);
  const [activeLocation, setActiveLocation] = useState(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    // 1. 準備新的歷史紀錄
    const userMsg = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
    
    setMessages(newHistory);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }), // 傳送完整歷史
      });

      const data = await res.json();

      // 2. 顯示 AI 回覆
      const assistantMsg = { role: 'assistant', content: data.content };
      setMessages([...newHistory, assistantMsg]);

      // 3. 只有當 AI 決定更新行程時 (plan 不為 null)，才更新地圖
      if (data.plan) {
        setPlan(data.plan);
      }
    } catch (err) {
      console.error(err);
      setMessages([
        ...newHistory,
        { role: 'assistant', content: '系統連線錯誤，請稍後再試。' },
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

  const displayTime = (time) => {
    switch (time) {
      case 'morning': return '早上';
      case 'noon': return '中午';
      case 'afternoon': return '下午';
      case 'evening': return '傍晚';
      case 'night': return '晚上';
      default: return time;
    }
  };

  const displayType = (type) => {
    switch (type) {
      case 'sight': return '景點';
      case 'food': return '美食';
      case 'shopping': return '購物';
      case 'activity': return '活動';
      default: return type;
    }
  };

  return (
    <div className="app-root">
      <div className="app-shell">
        <div className="app-header">
          <div className="app-header-title">
            <span className="logo-dot" />
            旅遊聊天小助手 · 智慧對話版
          </div>
          <div className="app-header-subtitle">
            現在可以正常聊天囉！試試看：「我想去台南吃牛肉湯」，它會先回答你，當你說「幫我排進行程」時才會更新地圖。
          </div>
        </div>

        <div className="main-layout">
          {/* 左側聊天區 */}
          <div className="chat-panel">
            <div className="chat-messages">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={'chat-row ' + (m.role === 'user' ? 'user' : 'assistant')}
                >
                  <div className={'bubble ' + (m.role === 'user' ? 'bubble-user' : 'bubble-assistant')}>
                    {/* 支援換行顯示 */}
                    {m.content.split('\n').map((line, i) => (
                      <div key={i} style={{ minHeight: '1.2em' }}>{line}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="chat-input-area">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="輸入訊息..."
                className="chat-textarea"
              />
              <button onClick={handleSend} disabled={isSending} className="send-button">
                {isSending ? '...' : '送出'}
              </button>
            </div>
          </div>

          {/* 右側視覺區 */}
          <div className="visualization-panel">
            
            {/* 地圖 */}
            <div className="card map-card">
              <div className="card-header">
                <span className="dot" /> 行程地圖
              </div>
              <MapView 
                plan={plan} 
                activeLocation={activeLocation}        
                onLocationChange={setActiveLocation}   
              />
            </div>

            {/* 行程列表 */}
            <div className="card plan-card">
              <div className="card-header">
                <span className="dot" /> 行程預覽
              </div>

              {plan ? (
                // 🔥 修正重點：加上 className="plan-content"
                // 這樣只有這個區塊會捲動，不會影響到上面的標題
                <div className="plan-content" style={{ fontSize: '13px' }}>
                  <div className="plan-summary">
                    <div><strong>城市：</strong>{plan.city || '（未指定）'}</div>
                    <div><strong>概要：</strong>{plan.summary || '（無概要）'}</div>
                  </div>

                  {(plan.days || []).map((day) => (
                    <div key={day.day} className="plan-day-block">
                      <div className="plan-day-title">
                        第 {day.day} 天 · {day.title || '未命名主題'}
                      </div>
                      <ul className="plan-item-list">
                        {(day.items || []).map((item, idx) => {
                          const isActive =
                            activeLocation &&
                            Number(activeLocation.day) === Number(day.day) &&
                            Number(activeLocation.order) === idx;

                          return (
                            <li
                              key={idx}
                              className={'plan-item' + (isActive ? ' plan-item-active' : '')}
                              onClick={() => setActiveLocation({ day: Number(day.day), order: idx })}
                            >
                              <div className="plan-item-main">
                                <strong>{displayTime(item.time)}：</strong>
                                {item.name} <span className="plan-item-type">({displayType(item.type)})</span>
                              </div>
                              {item.note && <div className="plan-item-note">{item.note}</div>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="plan-empty-text">
                  目前地圖是空的。<br/>
                  試著說：「幫我安排台北一日遊」來生成行程。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;