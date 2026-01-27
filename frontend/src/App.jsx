// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';
import MapView from './MapView';

// WMO Weather Code 轉換表 (Open-Meteo)
const getWeatherIcon = (code) => {
  if (code === undefined || code === null) return null;
  if (code <= 1) return '☀️'; // 晴天
  if (code <= 3) return '⛅'; // 多雲
  if (code <= 48) return '🌫️'; // 霧
  if (code <= 67) return '🌧️'; // 雨
  if (code <= 77) return '❄️'; // 雪
  if (code <= 82) return '🌧️'; // 陣雨
  if (code <= 86) return '❄️'; // 陣雪
  if (code <= 99) return '⛈️'; // 雷雨
  return '🌡️';
};

function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '嗨，我是旅遊小助手！我可以幫你安排行程。試試看：「我想去東京五天四夜，10月20號出發」' },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [plan, setPlan] = useState(null);
  const [activeLocation, setActiveLocation] = useState(null);
  
  const [weatherData, setWeatherData] = useState(null);

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
        setWeatherData(null); // 清空舊天氣
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

  // 當 plan 有 startDate 時，自動去抓天氣
  useEffect(() => {
    if (plan && plan.city && plan.startDate) {
      console.log('正在獲取天氣資訊...', plan.city, plan.startDate);
      fetch('http://localhost:3000/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: plan.city, startDate: plan.startDate }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.daily) {
            setWeatherData(data.daily);
          }
        })
        .catch((err) => console.error('天氣獲取失敗', err));
    }
  }, [plan]);

  // 取得天氣資訊
  const getWeatherForDay = (dayIndex) => {
    if (!weatherData || !weatherData.time) return null;
    const code = weatherData.weathercode[dayIndex];
    const maxT = weatherData.temperature_2m_max[dayIndex];
    const minT = weatherData.temperature_2m_min[dayIndex];
    // 注意：如果超出預測範圍 (例如第10天)，Open-Meteo 可能會給 undefined，這裡要檢查
    if (code === undefined || maxT === undefined) return null;

    return { icon: getWeatherIcon(code), max: maxT, min: minT };
  };

  // 🔥 新增：單純計算日期字串 (不依賴天氣 API)
  const formatDate = (startDate, dayIndex) => {
    if (!startDate) return null;
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayIndex); 
    // 格式化為 MM-DD
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${m}-${d}`;
  };

  // 捲動邏輯
  const handleDayChange = (day) => {
    if (day) {
      const el = document.getElementById(`day-header-${day}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const el = document.querySelector('.plan-content');
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (activeLocation) {
      const el = document.getElementById(`item-${activeLocation.day}-${activeLocation.order}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

          <div className="visualization-panel">
            
            <div className="card map-card">
              <div className="card-header">
                <span className="dot" /> 行程地圖
              </div>
              <MapView 
                plan={plan} 
                activeLocation={activeLocation}        
                onLocationChange={setActiveLocation}
                onDayChange={handleDayChange}
              />
            </div>

            <div className="card plan-card">
              <div className="card-header">
                <span className="dot" /> 行程預覽
              </div>

              {plan ? (
                <div className="plan-content" style={{ fontSize: '13px' }}>
                  <div className="plan-summary">
                    <div><strong>城市：</strong>{plan.city || '（未指定）'}</div>
                    <div><strong>概要：</strong>{plan.summary || '（無概要）'}</div>
                    {plan.startDate && <div style={{marginTop: 4, color: '#666'}}>📅 出發日期：{plan.startDate}</div>}
                  </div>

                  {(plan.days || []).map((day, dayIdx) => {
                    const weather = getWeatherForDay(dayIdx);
                    // 🔥 計算日期字串
                    const dateStr = formatDate(plan.startDate, dayIdx);

                    return (
                      <div key={day.day} id={`day-header-${day.day}`} className="plan-day-block">
                        <div className="plan-day-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>第 {day.day} 天 · {day.title || '未命名主題'}</span>
                          
                          <span style={{ fontSize: '0.85em', fontWeight: 'normal', color: '#555', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {/* 1. 無論有沒有天氣，只要有日期就顯示 */}
                            {dateStr && <span>{dateStr}</span>}

                            {/* 2. 有天氣才顯示圖示 */}
                            {weather && (
                              <>
                                <span style={{ fontSize: '1.2em' }}>{weather.icon}</span>
                                <span>{weather.min}°-{weather.max}°</span>
                              </>
                            )}
                          </span>
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
                    );
                  })}
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