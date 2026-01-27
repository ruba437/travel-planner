// frontend/src/App.jsx
import { useState, useEffect } from 'react';
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

    const userMsg = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
    
    setMessages(newHistory);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }), 
      });

      const data = await res.json();

      const assistantMsg = { role: 'assistant', content: data.content };
      setMessages([...newHistory, assistantMsg]);

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

  // 🔥 新增：當從地圖切換天數時，列表自動捲動到該天標題
  const handleDayChange = (day) => {
    if (day) {
      const el = document.getElementById(`day-header-${day}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      // 如果切回「全部」，捲動到最上面
      const el = document.querySelector('.plan-content');
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 🔥 新增：當選中某個地點時 (從地圖點擊)，列表自動捲動到該項目
  useEffect(() => {
    if (activeLocation) {
      const el = document.getElementById(`item-${activeLocation.day}-${activeLocation.order}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLocation]);

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
            旅遊聊天小助手
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
                onDayChange={handleDayChange} // 🔥 傳入回呼函式
              />
            </div>

            {/* 行程列表 */}
            <div className="card plan-card">
              <div className="card-header">
                <span className="dot" /> 行程預覽
              </div>

              {plan ? (
                <div className="plan-content" style={{ fontSize: '13px' }}>
                  <div className="plan-summary">
                    <div><strong>城市：</strong>{plan.city || '（未指定）'}</div>
                    <div><strong>概要：</strong>{plan.summary || '（無概要）'}</div>
                  </div>

                  {(plan.days || []).map((day) => (
                    // 🔥 加上 ID 供捲動定位
                    <div key={day.day} id={`day-header-${day.day}`} className="plan-day-block">
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
                              // 🔥 加上 ID 供捲動定位
                              id={`item-${day.day}-${idx}`}
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