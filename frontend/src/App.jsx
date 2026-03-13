// frontend/src/App.jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './App.css';
import MapView from './MapView';
import { useAuth } from './page/Authentication/AuthContext';

//設定安全預設網址
const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const getWeatherIcon = (code) => {
  if (code === undefined || code === null) return null;
  if (code <= 1) return '☀️'; 
  if (code <= 3) return '⛅'; 
  if (code <= 48) return '🌫️'; 
  if (code <= 67) return '🌧️'; 
  if (code <= 77) return '❄️'; 
  if (code <= 82) return '🌧️'; 
  if (code <= 86) return '❄️'; 
  if (code <= 99) return '⛈️'; 
  return '🌡️';
};

function App() {
  const { user, token, logout } = useAuth();
  const { uuid: itineraryUuidParam } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([
    { role: 'assistant', content: '嗨，我是旅遊小助手！我可以幫你安排行程。試試看：「我想去東京五天四夜，10月20號出發」' },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [plan, setPlan] = useState(null);
  const [activeLocation, setActiveLocation] = useState(null);
  
  const [weatherData, setWeatherData] = useState(null);
  const [totalBudget, setTotalBudget] = useState(50000);

  // 行程保存相關狀態
  const [itineraryUuid, setItineraryUuid] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [isLoadingItinerary, setIsLoadingItinerary] = useState(false);

  // 載入已有行程
  useEffect(() => {
    if (itineraryUuidParam) {
      loadItinerary(itineraryUuidParam);
    }
  }, [itineraryUuidParam]);

  const loadItinerary = async (uuid) => {
    setIsLoadingItinerary(true);
    try {
      const res = await fetch(`${API_BASE}/api/itineraries/${uuid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('載入行程失敗');
      const data = await res.json();
      if (data.itineraryData) {
        setPlan(data.itineraryData);
        setItineraryUuid(data.uuid);
        if (data.itineraryData.totalBudget) {
          setTotalBudget(data.itineraryData.totalBudget);
        }
        setMessages([
          { role: 'assistant', content: `已載入行程「${data.title || data.summary || ''}」，您可以繼續修改。` },
        ]);
        setWeatherData(null);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: 'assistant', content: '載入行程失敗，請稍後再試。' }]);
    } finally {
      setIsLoadingItinerary(false);
    }
  };

  const handleSave = async () => {
    if (!plan) return;
    setIsSaving(true);
    setSaveMsg(null);
    const payload = {
      title: plan.summary || `${plan.city || ''}旅遊行程`,
      summary: plan.summary || '',
      city: plan.city || '',
      startDate: plan.startDate || null,
      itineraryData: { ...plan, totalBudget },
    };
    try {
      let res;
      if (itineraryUuid) {
        res = await fetch(`${API_BASE}/api/itineraries/${itineraryUuid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE}/api/itineraries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) throw new Error('保存失敗');
      const data = await res.json();
      if (data.uuid) {
        setItineraryUuid(data.uuid);
        navigate(`/planner/${data.uuid}`, { replace: true });
      }
      setSaveMsg('已保存');
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err) {
      console.error(err);
      setSaveMsg('保存失敗');
      setTimeout(() => setSaveMsg(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async (quickText) => {
    // 1. 支援快捷按鈕的文字：如果有傳入 quickText 就用它，否則用輸入框的 input
    const text = typeof quickText === 'string' ? quickText.trim() : input.trim();
    if (!text || isSending) return;

    const userMsg = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
    
    setMessages(newHistory);
    // 送出後清空輸入框
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          messages: newHistory,
          currentPlan: plan 
        }), 
      });

      const data = await res.json();

      // 2. 錯誤防護：如果後端回傳 500 或 error，主動拋出錯誤，進入 catch 區塊
      if (!res.ok || data.error) {
        throw new Error(data.error || '後端回傳錯誤');
      }

      // 3. 安全處理 content：確保 content 絕對是字串，避免 .split() 導致畫面崩潰
      const safeContent = data.content || '行程已為您更新，請查看右側地圖與列表。';
      const assistantMsg = { role: 'assistant', content: safeContent };

      setMessages([...newHistory, assistantMsg]);

      // 4. 如果有生成新的行程計畫，則更新畫面
      if (data.plan) {
        setPlan(data.plan);
        if (data.plan.totalBudget) {
          setTotalBudget(data.plan.totalBudget);
        }
        setWeatherData(null); 
      }
    } catch (err) {
      console.error('Chat API Error:', err);
      // 發生錯誤時，優雅地在聊天室顯示錯誤訊息，而不是讓整個畫面死掉
      setMessages([
        ...newHistory,
        { role: 'assistant', content: '系統連線錯誤或 AI 思考中斷，請稍後再試。' },
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

  useEffect(() => {
    if (plan && plan.city && plan.startDate) {
      console.log('正在獲取天氣資訊...', plan.city, plan.startDate);
      // 使用 API_BASE 發送請求
      fetch(`${API_BASE}/api/weather`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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

  const getWeatherForDay = (dayIndex) => {
    if (!weatherData || !weatherData.time) return null;
    const code = weatherData.weathercode[dayIndex];
    const maxT = weatherData.temperature_2m_max[dayIndex];
    const minT = weatherData.temperature_2m_min[dayIndex];
    if (code === undefined || maxT === undefined) return null;

    return { icon: getWeatherIcon(code), max: maxT, min: minT };
  };

  const formatDate = (startDate, dayIndex) => {
    if (!startDate) return null;
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayIndex); 
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${m}-${d}`;
  };

  const updateActivityCost = (dayIdx, itemIdx, newCost) => {
  if (!plan) return;
  const newPlan = { ...plan };
  newPlan.days[dayIdx].items[itemIdx].cost = Number(newCost) || 0;
  setPlan(newPlan);
};

  const totalSpent = plan ? plan.days.reduce((sum, day) => {
    return sum + (day.items || []).reduce((daySum, item) => daySum + (Number(item.cost) || 0), 0);
  }, 0) : 0;

  const remaining = totalBudget - totalSpent;

  const mapData = useMemo(() => {
  if (!plan) return null;
  return {
    ...plan,
    startLocation: plan.startLocation,
    startTime: plan.startTime,
    days: plan.days.map(day => ({
      ...day,
      items: day.items.map(item => ({
        name: item.name,
        location: item.location,
        type: item.type,
        // 故意不包含 cost，這樣金額變動就不會觸發 mapData 更新
      }))
    }))
  };
  // 依賴項：我們只在 plan 的結構或核心內容改變時才重新計算
}, [plan?.city, JSON.stringify(plan?.days?.map(d => d.items.map(i => i.name)))]);

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

  const exportPlan = () => {
    if (!plan || !plan.days || plan.days.length === 0) {
      alert('目前沒有行程可以導航，請先規劃行程。');
      return;
    }

    const places = plan.days
      .flatMap(day => day.items || [])
      .filter(item => item.name)
      .map(item =>
        item.location?.lat && item.location?.lng
          ? `${item.location.lat},${item.location.lng}`
          : item.name
      );

    if (places.length === 0) {
      alert('行程中沒有地點資訊。');
      return;
    }

    // Google Maps 方向連結（不需要 API key）
    const url = `https://www.google.com/maps/dir/${places.map(p => encodeURIComponent(p)).join('/')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
      {isLoadingItinerary && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>載入行程中...</p>
        </div>
      )}
      <div className="app-shell">
        <div className="app-header">
          <div className="app-header-title">
            <span className="logo-dot" />
            旅遊聊天小助手
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', fontWeight: 400 }}>
              <button onClick={() => navigate('/')} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.85rem', color: '#374151' }}>← 我的行程</button>
              <button onClick={handleSave} disabled={!plan || isSaving} style={{ background: plan ? '#10b981' : '#d1d5db', color: 'white', border: 'none', borderRadius: 6, padding: '4px 14px', cursor: plan ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: 600 }}>
                {isSaving ? '保存中...' : itineraryUuid ? '更新行程' : '保存行程'}
              </button>
              {saveMsg && <span style={{ color: saveMsg === '已保存' ? '#10b981' : '#ef4444', fontWeight: 500 }}>{saveMsg}</span>}
              <button onClick={exportPlan}>google導航</button>
              <span style={{ color: '#6b7280' }}>{user?.displayName || user?.email}</span>
              <button onClick={logout} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.85rem', color: '#374151' }}>登出</button>
            </span>
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

            {/* 快捷選項區塊 🔥 */}
            <div className="quick-actions-container">
              <div className="quick-actions">
                <button 
                  className="quick-action-btn"
                  onClick={() => handleSend('請幫我多排一些行程')}
                  disabled={isSending}
                >
                  ⏱️ 行程多一點
                </button>
                <button 
                  className="quick-action-btn"
                  onClick={() => handleSend('請幫我少排一些行程')}
                  disabled={isSending}
                >
                  ☕ 行程少一點
                </button>
                <button 
                  className="quick-action-btn"
                  onClick={() => handleSend('請提供我幾個住宿的推薦選項')}
                  disabled={isSending}
                >
                  🏨 提供住宿選項
                </button>
                <button 
                  className="quick-action-btn"
                  onClick={() => handleSend('請推薦幾個當地美食')}
                  disabled={isSending}
                >
                  🍜 推薦在地美食
                </button>
              </div>
            </div>
            {/* 🔥 新增結束 🔥 */}

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
                plan={mapData} // 使用過濾後的資料
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

                  <div className="budget-dashboard">
                    <div className="budget-row">
                      <span>總預算：</span>
                      <input 
                        type="number" 
                        className="budget-main-input"
                        value={totalBudget} 
                        onChange={(e) => setTotalBudget(Number(e.target.value))} 
                      />
                    </div>
                    <div className="budget-status">
                      <span style={{ color: totalSpent > totalBudget ? '#ef4444' : '#666' }}>
                        已支出: ${totalSpent.toLocaleString()}
                      </span>
                      <span className={remaining < 0 ? 'budget-over' : 'budget-under'}>
                        {remaining >= 0 ? `剩餘: $${remaining.toLocaleString()}` : `超額: $${Math.abs(remaining).toLocaleString()}`}
                      </span>
                    </div>
                    <div className="budget-progress-bg">
                      <div 
                        className="budget-progress-fill" 
                        style={{ 
                          width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%`,
                          backgroundColor: totalSpent > totalBudget ? '#ef4444' : '#10b981'
                        }}
                      />
                    </div>
                  </div>

                  {(plan.days || []).map((day, dayIdx) => {
                    const weather = getWeatherForDay(dayIdx);
                    const dateStr = formatDate(plan.startDate, dayIdx);

                    return (
                      <div key={day.day} id={`day-header-${day.day}`} className="plan-day-block">
                        <div className="plan-day-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>第 {day.day} 天 · {day.title || '未命名主題'}</span>
                          <span style={{ fontSize: '0.85em', fontWeight: 'normal', color: '#555', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {dateStr && <span>{dateStr}</span>}
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
                                  <div className="item-cost-input" onClick={(e) => e.stopPropagation()}>
                                    $ <input 
                                      type="number" 
                                      placeholder="金額"
                                      value={item.cost || ''} 
                                      onChange={(e) => updateActivityCost(dayIdx, idx, e.target.value)}
                                    />
                                  </div>
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