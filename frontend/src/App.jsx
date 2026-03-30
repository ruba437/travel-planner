import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import MapView from './MapView';
import { useAuth } from './page/Authentication/AuthContext';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

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

const TYPE_ICON = {
  sight: '🗺️',
  food: '🍜',
  shopping: '🛍️',
  activity: '🎯',
  hotel: '🏨',
  transport: '🚌',
};

const TYPE_COLOR = {
  sight: '#0ea5e9',
  food: '#f97316',
  shopping: '#ec4899',
  activity: '#10b981',
  hotel: '#7c3aed',
  transport: '#6b7280',
};

const WEEKDAYS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const MONTHS_ZH = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const DEFAULT_DAY_START_TIME = '09:00';
const DEFAULT_CHECKLIST = [{ id: 1, text: '物品', checked: false }];

const normalizeTimeValue = (value, fallback = DEFAULT_DAY_START_TIME) => {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return fallback;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

function App() {
  const { user, token, logout } = useAuth();
  const { uuid: itineraryUuidParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hasAppliedPrefill = useRef(false);

  const [messages, setMessages] = useState([
    { role: 'assistant', content: '嗨，我是旅遊小助手！我可以幫你安排行程。試試看：「我想去東京五天四夜，10月20號出發」' },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [plan, setPlan] = useState(null);
  const [activeLocation, setActiveLocation] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [totalBudget, setTotalBudget] = useState(50000);
  const [itineraryUuid, setItineraryUuid] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [isLoadingItinerary, setIsLoadingItinerary] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('itinerary'); // 'info' | 'itinerary'
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [packingItems, setPackingItems] = useState(DEFAULT_CHECKLIST);
  const [tripNote, setTripNote] = useState('');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [isEditingHero, setIsEditingHero] = useState(false);
  const [tripNameInput, setTripNameInput] = useState('');
  const [tripStartDateInput, setTripStartDateInput] = useState('');
  const [tripStartTimeInput, setTripStartTimeInput] = useState(DEFAULT_DAY_START_TIME);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (itineraryUuidParam) loadItinerary(itineraryUuidParam);
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
        const loadedPlan = data.itineraryData || {};
        const mergedPlan = {
          ...loadedPlan,
          tripName: data.title || loadedPlan.tripName || loadedPlan.summary || '',
          startDate: data.startDate || loadedPlan.startDate || null,
          startTime: normalizeTimeValue(data.startTime || loadedPlan.startTime, DEFAULT_DAY_START_TIME),
        };
        setPlan(mergedPlan);
        setItineraryUuid(data.uuid);
        setTripNameInput(mergedPlan.tripName || '');
        setTripStartDateInput(mergedPlan.startDate || '');
        setTripStartTimeInput(mergedPlan.startTime || DEFAULT_DAY_START_TIME);
        setTripNote(data.tripNote || loadedPlan.tripNote || '');

        const serverChecklist = Array.isArray(data.checklistItems) ? data.checklistItems : null;
        const jsonChecklist = Array.isArray(loadedPlan.packingItems) ? loadedPlan.packingItems : null;
        const rawChecklist = serverChecklist || jsonChecklist || DEFAULT_CHECKLIST;
        const normalizedChecklist = rawChecklist
          .map((item, idx) => ({
            id: item.id || Date.now() + idx,
            text: String(item.text || '').trim(),
            checked: Boolean(item.checked),
          }))
          .filter((item) => item.text.length > 0);
        setPackingItems(normalizedChecklist.length > 0 ? normalizedChecklist : DEFAULT_CHECKLIST);

        if (mergedPlan.totalBudget) setTotalBudget(mergedPlan.totalBudget);
        setMessages([{ role: 'assistant', content: `已載入行程「${data.title || data.summary || ''}」，您可以繼續修改。` }]);
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
    const cleanedTripName = (plan.tripName || '').trim();
    const checklistPayload = (packingItems || [])
      .map((item, idx) => ({
        id: item.id || `${Date.now()}-${idx}`,
        text: String(item.text || '').trim(),
        checked: Boolean(item.checked),
      }))
      .filter((item) => item.text.length > 0);

    const payload = {
      title: cleanedTripName || plan.summary || `${plan.city || ''}旅遊行程`,
      summary: plan.summary || '',
      city: plan.city || '',
      startDate: plan.startDate || null,
      startTime: normalizeTimeValue(plan.startTime, DEFAULT_DAY_START_TIME),
      tripNote,
      checklistItems: checklistPayload,
      itineraryData: {
        ...plan,
        tripName: cleanedTripName,
        startTime: normalizeTimeValue(plan.startTime, DEFAULT_DAY_START_TIME),
        tripNote,
        packingItems: checklistPayload,
        totalBudget,
      },
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
    const text = typeof quickText === 'string' ? quickText.trim() : input.trim();
    if (!text || isSending) return;
    const userMsg = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setIsSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newHistory, currentPlan: plan }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || '後端回傳錯誤');
      const safeContent = data.content || '行程已為您更新，請查看右側地圖與列表。';
      setMessages([...newHistory, { role: 'assistant', content: safeContent }]);
      if (data.plan) {
        if (data.plan.days && Array.isArray(data.plan.days)) {
          data.plan.days = data.plan.days.map((day) => {
            let baseTime = '09:00';
            if (day.items && day.items.length > 0 && day.items[0].time) {
              baseTime = day.items[0].time.split('~')[0];
            }
            return { ...day, items: recalculateDayTimes(day.items, baseTime) };
          });
        }
        setPlan(data.plan);
        if (data.plan.totalBudget) setTotalBudget(data.plan.totalBudget);
        setWeatherData(null);
      }
    } catch (err) {
      console.error('Chat API Error:', err);
      setMessages([...messages, { role: 'assistant', content: '系統連線錯誤或 AI 思考中斷，請稍後再試。' }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  useEffect(() => {
    if (itineraryUuidParam || hasAppliedPrefill.current) return;
    const prefill = location?.state?.prefill;
    if (!prefill) return;
    const startLocation = (prefill.startLocation || '').trim();
    const { startDate, endDate } = prefill;
    if (!startLocation || !startDate || !endDate) return;
    hasAppliedPrefill.current = true;
    const prompt = prefill.prompt || `請幫我規劃旅程，起點是${startLocation}，旅遊日期從${startDate}到${endDate}。`;
    setInput(prompt);
    setMessages((prev) => [...prev, { role: 'assistant', content: `已收到資料：起點 ${startLocation}，旅遊區間 ${startDate} 到 ${endDate}。` }]);
    if (prefill.autoSend) handleSend(prompt);
  }, [location, itineraryUuidParam]);

  useEffect(() => {
    if (plan && plan.city && plan.startDate) {
      fetch(`${API_BASE}/api/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ city: plan.city, startDate: plan.startDate }),
      })
        .then((res) => res.json())
        .then((data) => { if (data.daily) setWeatherData(data.daily); })
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

  const getDayLabel = (startDate, dayIndex) => {
    if (!startDate) return { date: `第${dayIndex + 1}天`, weekday: '' };
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayIndex);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const wd = WEEKDAYS_ZH[date.getDay()];
    return { date: `${m}月${d}日`, weekday: wd, full: `${wd}，${m} ${d}` };
  };

  const updateActivityCost = (dayIdx, itemIdx, newCost) => {
    if (!plan) return;
    const newPlan = { ...plan, days: plan.days.map((day, di) => di !== dayIdx ? day : {
      ...day, items: day.items.map((item, ii) => ii !== itemIdx ? item : { ...item, cost: Number(newCost) || 0 })
    }) };
    setPlan(newPlan);
  };

  const handleAddLocationFromMap = (locationData) => {
    if (!plan || !plan.days || plan.days.length === 0 || locationData.targetDayIndex === undefined) {
      alert('請先讓 AI 產生一個基本的行程，才能手動加入景點喔！');
      return;
    }
    const targetDayIdx = locationData.targetDayIndex;
    const newPlan = { ...plan, days: [...plan.days] };
    const dayItems = [...(plan.days[targetDayIdx].items || [])];
    dayItems.push({ name: locationData.name, type: locationData.type || 'sight', time: '', cost: 0, note: `手動從地圖加入 (第 ${targetDayIdx + 1} 天)`, location: { lat: locationData.lat, lng: locationData.lng } });
    newPlan.days[targetDayIdx] = { ...plan.days[targetDayIdx], items: recalculateDayTimes(dayItems, getTrueStartTime(targetDayIdx)) };
    setPlan(newPlan);
    setActiveLocation({ day: targetDayIdx + 1, order: dayItems.length - 1 });
  };

  const updateActivityTime = (dayIdx, itemIdx, newTime) => {
    if (!plan) return;
    const newPlan = { ...plan, days: [...plan.days] };
    const newItems = [...plan.days[dayIdx].items];
    const oldTime = newItems[itemIdx].time || '';
    let [oldStart, oldEnd] = oldTime.includes('~') ? oldTime.split('~') : [oldTime, ''];
    let [newStart, newEnd] = newTime.includes('~') ? newTime.split('~') : [newTime, ''];
    let durationMinutes = 120;
    if (oldStart && oldEnd && oldStart.includes(':') && oldEnd.includes(':')) {
      const [sH, sM] = oldStart.split(':').map(Number);
      const [eH, eM] = oldEnd.split(':').map(Number);
      durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);
      if (durationMinutes <= 0) durationMinutes = 120;
    }
    if (newStart !== oldStart && newEnd === oldEnd && newStart.includes(':')) {
      const [sH, sM] = newStart.split(':').map(Number);
      const endDate = new Date(); endDate.setHours(sH, sM + durationMinutes, 0, 0);
      newEnd = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
      newTime = `${newStart}~${newEnd}`;
    }
    newItems[itemIdx] = { ...newItems[itemIdx], time: newTime };
    let currentEndTime = newEnd;
    if (currentEndTime && currentEndTime.includes(':')) {
      for (let i = itemIdx + 1; i < newItems.length; i++) {
        let nextItem = { ...newItems[i] };
        let nextDuration = 120;
        if (nextItem.time && nextItem.time.includes('~')) {
          const [ns, ne] = nextItem.time.split('~');
          if (ns.includes(':') && ne.includes(':')) {
            const [sH, sM] = ns.split(':').map(Number); const [eH, eM] = ne.split(':').map(Number);
            nextDuration = (eH * 60 + eM) - (sH * 60 + sM);
            if (nextDuration <= 0) nextDuration = 120;
          }
        }
        const [currH, currM] = currentEndTime.split(':').map(Number);
        const startDate = new Date(); startDate.setHours(currH, currM + 30, 0, 0);
        const newStartStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
        const endDate = new Date(startDate); endDate.setMinutes(endDate.getMinutes() + nextDuration);
        const newEndStr = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
        nextItem.time = `${newStartStr}~${newEndStr}`;
        newItems[i] = nextItem;
        currentEndTime = newEndStr;
      }
    }
    newPlan.days[dayIdx] = { ...plan.days[dayIdx], items: newItems };
    setPlan(newPlan);
  };

  const totalSpent = plan ? plan.days.reduce((sum, day) => sum + (day.items || []).reduce((ds, item) => ds + (Number(item.cost) || 0), 0), 0) : 0;
  const remaining = totalBudget - totalSpent;

  const mapData = useMemo(() => {
    if (!plan) return null;
    return { ...plan, days: plan.days.map(day => ({ ...day, items: day.items.map(item => ({ name: item.name, location: item.location, type: item.type })) })) };
  }, [plan?.city, JSON.stringify(plan?.days?.map(d => d.items.map(i => i.name)))]);

  const getTrueStartTime = (dayIdx) => {
    if (plan?.days?.[dayIdx]?.items?.length > 0 && plan.days[dayIdx].items[0].time) {
      const firstItemStart = plan.days[dayIdx].items[0].time.split('~')[0];
      const [h, m] = firstItemStart.split(':').map(Number);
      const d = new Date(); d.setHours(h, m - 30, 0, 0);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return normalizeTimeValue(plan?.startTime, DEFAULT_DAY_START_TIME);
  };

  const recalculateDayTimes = (items, dayStartTime = '09:00') => {
    if (!items || items.length === 0) return items;
    let currentStartTime = dayStartTime;
    return items.map((item) => {
      let durationMinutes = 120;
      if (item.time && item.time.includes('~')) {
        const [oldStart, oldEnd] = item.time.split('~');
        const [sH, sM] = oldStart.split(':').map(Number); const [eH, eM] = oldEnd.split(':').map(Number);
        if (!isNaN(sH) && !isNaN(eH)) { durationMinutes = (eH * 60 + eM) - (sH * 60 + sM); if (durationMinutes <= 0) durationMinutes = 120; }
      }
      const [currH, currM] = currentStartTime.split(':').map(Number);
      const arrivalDate = new Date(); arrivalDate.setHours(currH, currM + 30, 0, 0);
      const assignedStartTime = `${arrivalDate.getHours().toString().padStart(2, '0')}:${arrivalDate.getMinutes().toString().padStart(2, '0')}`;
      const [h, m] = assignedStartTime.split(':').map(Number);
      const endDate = new Date(); endDate.setHours(h, m + durationMinutes, 0, 0);
      const assignedEndTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
      currentStartTime = assignedEndTime;
      return { ...item, time: `${assignedStartTime}~${assignedEndTime}` };
    });
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const newPlan = { ...plan };
    const sourceDayIdx = parseInt(source.droppableId.split('-')[1], 10);
    const destDayIdx = parseInt(destination.droppableId.split('-')[1], 10);
    const destDayStartTime = getTrueStartTime(destDayIdx);
    const sourceDayStartTime = getTrueStartTime(sourceDayIdx);
    const sourceItems = Array.from(newPlan.days[sourceDayIdx].items);
    const destItems = sourceDayIdx === destDayIdx ? sourceItems : Array.from(newPlan.days[destDayIdx].items);
    const [movedItem] = sourceItems.splice(source.index, 1);
    destItems.splice(destination.index, 0, movedItem);
    if (sourceDayIdx === destDayIdx) {
      newPlan.days[sourceDayIdx].items = recalculateDayTimes(sourceItems, destDayStartTime);
    } else {
      newPlan.days[sourceDayIdx].items = recalculateDayTimes(sourceItems, sourceDayStartTime);
      newPlan.days[destDayIdx].items = recalculateDayTimes(destItems, destDayStartTime);
    }
    setPlan(newPlan);
  };

  const exportPlan = () => {
    if (!plan?.days?.length) { alert('目前沒有行程可以導航，請先規劃行程。'); return; }
    const places = plan.days.flatMap(day => day.items || []).filter(item => item.name)
      .map(item => item.location?.lat && item.location?.lng ? `${item.location.lat},${item.location.lng}` : item.name);
    if (!places.length) { alert('行程中沒有地點資訊。'); return; }
    window.open(`https://www.google.com/maps/dir/${places.map(p => encodeURIComponent(p)).join('/')}`, '_blank', 'noopener,noreferrer');
  };

  const displayType = (type) => ({ sight: '景點', food: '美食', shopping: '購物', activity: '活動', hotel: '住宿', transport: '交通' }[type] || type);

  const tripTitle = plan?.tripName?.trim() || (plan?.summary || plan?.city ? `${plan?.city || ''}之旅` : '台北之旅');
  const tripDateRange = plan?.startDate && plan?.days?.length
    ? (() => {
        const start = new Date(plan.startDate);
        const end = new Date(plan.startDate);
        end.setDate(end.getDate() + plan.days.length - 1);
        return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
      })()
    : '';

  const currentDay = plan?.days?.[activeDayIdx];
  const currentDayLabel = plan?.startDate ? getDayLabel(plan.startDate, activeDayIdx) : null;
  const currentPath = location?.pathname || '/';
  const getUserInitial = () => {
    const n = user?.displayName || user?.displayname || user?.email || '?';
    return n.charAt(0).toUpperCase();
  };

  const syncHeroEditorFromPlan = () => {
    setTripNameInput((plan?.tripName || '').trim() || '');
    setTripStartDateInput(plan?.startDate || '');
    setTripStartTimeInput(normalizeTimeValue(plan?.startTime, DEFAULT_DAY_START_TIME));
  };

  const openHeroEditor = () => {
    syncHeroEditorFromPlan();
    setIsEditingHero(true);
  };

  const handleHeroEditCancel = () => {
    syncHeroEditorFromPlan();
    setIsEditingHero(false);
  };

  const handleHeroEditSave = () => {
    if (!plan) {
      setIsEditingHero(false);
      return;
    }
    const nextTripName = tripNameInput.trim();
    const nextStartDate = tripStartDateInput || null;
    const nextStartTime = normalizeTimeValue(tripStartTimeInput, normalizeTimeValue(plan.startTime, DEFAULT_DAY_START_TIME));
    const nextDays = Array.isArray(plan.days)
      ? plan.days.map((day) => ({ ...day, items: recalculateDayTimes(day.items || [], nextStartTime) }))
      : plan.days;

    setPlan({
      ...plan,
      tripName: nextTripName,
      startDate: nextStartDate,
      startTime: nextStartTime,
      days: nextDays,
    });
    setIsEditingHero(false);
  };

  const addChecklistItem = () => {
    const text = newChecklistText.trim();
    if (!text) return;
    setPackingItems((prev) => [...prev, { id: Date.now(), text, checked: false }]);
    setNewChecklistText('');
  };

  const removeChecklistItem = (id) => {
    setPackingItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length > 0 ? next : DEFAULT_CHECKLIST;
    });
  };

  return (
    <div className="az-root">
      {isLoadingItinerary && (
        <div className="az-loading-overlay">
          <div className="az-spinner" />
          <p>載入行程中...</p>
        </div>
      )}

      {/* ── LEFT SIDEBAR ── */}
      <aside className={`az-sidebar${sidebarCollapsed ? ' az-sidebar--collapsed' : ''}`}>
        <div className="az-sidebar-inner">
          <div className="az-logo">
            <div className="az-logo-icon">✈</div>
            {!sidebarCollapsed && (
              <div className="az-logo-texts">
                <span className="az-logo-name">旅遊規劃器</span>
                <span className="az-beta-badge">BETA</span>
              </div>
            )}
          </div>

          <nav className="az-nav">
            <button
              className={`az-nav-item${currentPath === '/' ? ' az-nav-item--active' : ''}`}
              onClick={() => navigate('/')}
              title={sidebarCollapsed ? '首頁' : ''}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {!sidebarCollapsed && <span>首頁</span>}
            </button>
            <button
              className={`az-nav-item${currentPath.startsWith('/planner') ? ' az-nav-item--active' : ''}`}
              onClick={() => navigate('/planner')}
              title={sidebarCollapsed ? '我的行程' : ''}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
              {!sidebarCollapsed && <span>我的行程</span>}
            </button>
            <button className="az-nav-item" title={sidebarCollapsed ? '旅遊指南' : ''}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              {!sidebarCollapsed && <span>旅遊指南</span>}
            </button>
            <button className="az-nav-item" title={sidebarCollapsed ? '收藏' : ''}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              {!sidebarCollapsed && <span>收藏</span>}
            </button>
            <button className="az-nav-item" title={sidebarCollapsed ? '尋找旅伴' : ''}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {!sidebarCollapsed && <span>尋找旅伴</span>}
            </button>
          </nav>

          <div className="az-nav-spacer" />

          <button className="az-nav-item az-feedback" title={sidebarCollapsed ? '意見回饋' : ''}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {!sidebarCollapsed && <span>意見回饋</span>}
          </button>

          <div className="az-user-row">
            <div className="az-avatar">{getUserInitial()}</div>
            {!sidebarCollapsed && (
              <>
                <div className="az-user-info">
                  <span className="az-user-name">{user?.displayName || user?.displayname || '使用者'}</span>
                  <span className="az-user-email">{user?.email}</span>
                </div>
                <button className="az-user-chevron" onClick={logout} title="登出">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 3 18 9"/><polyline points="6 15 12 21 18 15"/></svg>
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="az-main">
        {/* TOP BAR */}
        <header className="az-topbar">
          
          
          <button className="az-topbar-icon-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>

          

          <button className={`az-topbar-btn ${showAiPanel ? 'az-topbar-btn--active' : ''}`} onClick={() => setShowAiPanel(!showAiPanel)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
            </svg>
            AI 助手
          </button>

          <button className="az-topbar-btn az-topbar-btn--primary" onClick={handleSave} disabled={!plan || isSaving}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
            {isSaving ? '保存中...' : itineraryUuid ? '更新行程' : '發佈為指南'}
          </button>

          <div className="az-topbar-spacer" />

          <button className="az-topbar-icon-btn" onClick={exportPlan} title="Google 導航">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16 10,8"/>
            </svg>
          </button>
          <button className="az-topbar-icon-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
            </svg>
          </button>

          {saveMsg && <span className={`az-save-msg ${saveMsg === '已保存' ? 'az-save-msg--ok' : 'az-save-msg--err'}`}>{saveMsg}</span>}
        </header>

        {/* CONTENT AREA */}
        <div className="az-content-wrap">
          {/* ── LEFT: Trip detail panel ── */}
          <div className="az-trip-panel">
            {/* HERO */}
            <div className="az-hero">
              <div className="az-hero-overlay" />
              <img
                className="az-hero-img"
                src={`https://source.unsplash.com/800x240/?${encodeURIComponent(plan?.city || 'taipei')},travel`}
                alt="trip cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="az-hero-content">
                <h1 className="az-hero-title">
                  {tripTitle}
                  <button className="az-hero-edit-btn" onClick={openHeroEditor} aria-label="編輯行程資訊">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </h1>
                {tripDateRange && (
                  <div className="az-hero-date">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {tripDateRange}
                    {plan?.startTime ? `・${normalizeTimeValue(plan.startTime, DEFAULT_DAY_START_TIME)} 出發` : ''}
                  </div>
                )}
                {isEditingHero && (
                  <div className="az-hero-edit-panel">
                    <div className="az-hero-edit-grid">
                      <input
                        className="az-hero-edit-input"
                        type="text"
                        value={tripNameInput}
                        onChange={(e) => setTripNameInput(e.target.value)}
                        placeholder="旅行名稱"
                      />
                      <input
                        className="az-hero-edit-input"
                        type="date"
                        value={tripStartDateInput || ''}
                        onChange={(e) => setTripStartDateInput(e.target.value)}
                      />
                      <input
                        className="az-hero-edit-input"
                        type="time"
                        value={normalizeTimeValue(tripStartTimeInput, DEFAULT_DAY_START_TIME)}
                        onChange={(e) => setTripStartTimeInput(e.target.value)}
                      />
                    </div>
                    <div className="az-hero-edit-actions">
                      <button className="az-hero-edit-action" onClick={handleHeroEditCancel}>取消</button>
                      <button className="az-hero-edit-action az-hero-edit-action--primary" onClick={handleHeroEditSave}>儲存</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* TABS */}
            <div className="az-tabs">
              <button className={`az-tab ${activeTab === 'info' ? 'az-tab--active' : ''}`} onClick={() => setActiveTab('info')}>資訊</button>
              <button className={`az-tab ${activeTab === 'itinerary' ? 'az-tab--active' : ''}`} onClick={() => setActiveTab('itinerary')}>行程</button>
            </div>

            {/* ── INFO TAB ── */}
            {activeTab === 'info' && (
              <div className="az-tab-content">
                <textarea
                  className="az-notes-input"
                  placeholder="請輸入旅程備註..."
                  value={tripNote}
                  onChange={(e) => setTripNote(e.target.value)}
                />

                <div className="az-section">
                  <div className="az-section-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>
                    <span>行前準備清單</span>
                  </div>
                  <div className="az-checklist">
                    {packingItems.map(item => (
                      <label key={item.id} className="az-check-row">
                        <input type="checkbox" checked={item.checked} onChange={() => setPackingItems(prev => prev.map(p => p.id === item.id ? { ...p, checked: !p.checked } : p))} />
                        <span className={item.checked ? 'az-check-done' : ''}>{item.text}</span>
                        <button type="button" className="az-check-delete" onClick={() => removeChecklistItem(item.id)} aria-label="刪除項目">✕</button>
                      </label>
                    ))}
                    <div className="az-check-add-row">
                      <input
                        className="az-check-input"
                        type="text"
                        value={newChecklistText}
                        onChange={(e) => setNewChecklistText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addChecklistItem();
                          }
                        }}
                        placeholder="新增行前項目，例如：護照、轉接頭"
                      />
                      <button className="az-add-item-btn" onClick={addChecklistItem}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        新增項目
                      </button>
                    </div>
                  </div>
                </div>

                <div className="az-section">
                  <div className="az-section-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>
                    <span>主要運輸安排</span>
                  </div>
                  <div className="az-empty-section">尚無運輸安排</div>
                </div>

                {/* Budget */}
                {plan && (
                  <div className="az-section">
                    <div className="az-section-header">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                      <span>預算追蹤</span>
                    </div>
                    <div className="az-budget-body">
                      <div className="az-budget-row">
                        <span>總預算</span>
                        <input type="number" className="az-budget-input" value={totalBudget} onChange={(e) => setTotalBudget(Number(e.target.value))} />
                      </div>
                      <div className="az-budget-bar-wrap">
                        <div className="az-budget-bar" style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%`, background: totalSpent > totalBudget ? '#ef4444' : '#10b981' }} />
                      </div>
                      <div className="az-budget-stats">
                        <span style={{ color: totalSpent > totalBudget ? '#ef4444' : '#6b7280' }}>已支出 ${totalSpent.toLocaleString()}</span>
                        <span className={remaining < 0 ? 'az-over' : 'az-under'}>
                          {remaining >= 0 ? `剩餘 $${remaining.toLocaleString()}` : `超額 $${Math.abs(remaining).toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ITINERARY TAB ── */}
            {activeTab === 'itinerary' && (
              <div className="az-tab-content">
                {plan?.days?.length > 0 ? (
                  <>
                    {/* Day selector */}
                    <div className="az-day-tabs">
                      {plan.days.map((day, idx) => {
                        const lbl = getDayLabel(plan.startDate, idx);
                        return (
                          <button
                            key={idx}
                            className={`az-day-tab ${activeDayIdx === idx ? 'az-day-tab--active' : ''}`}
                            onClick={() => setActiveDayIdx(idx)}
                          >
                            <span className="az-day-tab-date">{lbl.date}</span>
                            <span className="az-day-tab-num">第 {idx + 1} 天</span>
                          </button>
                        );
                      })}
                    </div>

                    <h2 className="az-itinerary-heading">行程</h2>

                    {/* All days rendered, filtered to active */}
                    <DragDropContext onDragEnd={onDragEnd}>
                      {plan.days.map((day, dayIdx) => {
                        if (dayIdx !== activeDayIdx) return null;
                        const lbl = getDayLabel(plan.startDate, dayIdx);
                        const weather = getWeatherForDay(dayIdx);
                        return (
                          <div key={dayIdx} className="az-day-block">
                            <div className="az-day-block-header">
                              <h3 className="az-day-block-title">
                                {lbl.weekday && <span>{lbl.weekday}</span>}，{lbl.date}
                                {day.title && <span className="az-day-theme">· {day.title}</span>}
                              </h3>
                              <div className="az-day-block-meta">
                                {weather && <span className="az-weather">{weather.icon} {weather.min}°–{weather.max}°</span>}
                                <button className="az-icon-btn">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                                  </svg>
                                </button>
                              </div>
                            </div>

                            <Droppable droppableId={`day-${dayIdx}`}>
                              {(provided, snapshot) => (
                                <div
                                  className={`az-items-list ${snapshot.isDraggingOver ? 'az-items-list--over' : ''}`}
                                  {...provided.droppableProps}
                                  ref={provided.innerRef}
                                >
                                  {(day.items || []).map((item, idx) => {
                                    const isActive = activeLocation && Number(activeLocation.day) === Number(day.day) && Number(activeLocation.order) === idx;
                                    const iconColor = TYPE_COLOR[item.type] || '#6b7280';
                                    return (
                                      <Draggable
                                        key={`item-${dayIdx}-${idx}-${item.name}`}
                                        draggableId={`item-${dayIdx}-${idx}-${item.name}`}
                                        index={idx}
                                      >
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            id={`item-${day.day}-${idx}`}
                                            className={`az-item-card ${isActive ? 'az-item-card--active' : ''} ${snapshot.isDragging ? 'az-item-card--dragging' : ''}`}
                                            onClick={() => setActiveLocation({ day: Number(day.day), order: idx })}
                                            style={provided.draggableProps.style}
                                          >
                                            <div className="az-item-icon" style={{ background: `${iconColor}18`, color: iconColor }}>
                                              {TYPE_ICON[item.type] || '📍'}
                                            </div>
                                            <div className="az-item-body">
                                              <div className="az-item-name">{item.name}</div>
                                              {item.time && (
                                                <div className="az-item-time">
                                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                                                  {item.time}
                                                </div>
                                              )}
                                            </div>
                                            <div className="az-item-right">
                                              <span className="az-item-type-badge" style={{ background: `${iconColor}18`, color: iconColor }}>
                                                {displayType(item.type)}
                                              </span>
                                              {item.cost > 0 && <span className="az-item-cost">${Number(item.cost).toLocaleString()}</span>}
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    );
                                  })}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>

                            <button className="az-add-item-btn az-add-item-btn--day" onClick={() => {
                              const name = prompt('新增地點名稱：');
                              if (name) {
                                const newPlan = { ...plan };
                                const dayItems = [...(plan.days[dayIdx].items || [])];
                                dayItems.push({ name, type: 'sight', time: '', cost: 0 });
                                newPlan.days = [...plan.days];
                                newPlan.days[dayIdx] = { ...plan.days[dayIdx], items: recalculateDayTimes(dayItems, getTrueStartTime(dayIdx)) };
                                setPlan(newPlan);
                              }
                            }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              新增項目
                            </button>
                          </div>
                        );
                      })}
                    </DragDropContext>
                  </>
                ) : (
                  <div className="az-empty-itinerary">
                    <div className="az-empty-icon">🗺️</div>
                    <p>尚無行程</p>
                    <p className="az-empty-hint">點選「AI 助手」開始規劃，或直接輸入目的地</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: MAP ── */}
          <div className="az-map-panel">
            <MapView
              plan={mapData}
              activeLocation={activeLocation}
              onLocationChange={setActiveLocation}
              onDayChange={(day) => { if (day !== null) setActiveDayIdx(day - 1); }}
              onAddLocation={handleAddLocationFromMap}
            />
          </div>
        </div>
      </div>

      {/* ── FLOATING AI PANEL ── */}
      {showAiPanel && (
        <div className="az-ai-panel">
          <div className="az-ai-header">
            <span className="az-ai-title">AI 助手</span>
            <button className="az-icon-btn" onClick={() => setMessages([{ role: 'assistant', content: '嗨，我是旅遊小助手！' }])}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,01-2,2H8a2,2,0,01-2-2L5,6"/>
                <path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/>
              </svg>
            </button>
          </div>

          <div className="az-ai-messages">
            {messages.map((m, idx) => (
              <div key={idx} className={`az-ai-msg ${m.role === 'user' ? 'az-ai-msg--user' : 'az-ai-msg--bot'}`}>
                {m.content.split('\n').map((line, i) => <div key={i}>{line || '\u00A0'}</div>)}
              </div>
            ))}
            {isSending && <div className="az-ai-msg az-ai-msg--bot az-ai-typing"><span /><span /><span /></div>}
            <div ref={chatEndRef} />
          </div>

          {/* Quick actions */}
          <div className="az-ai-quick">
            {['行程多一點', '行程少一點', '推薦住宿', '推薦美食'].map((q, i) => (
              <button key={i} className="az-quick-chip" onClick={() => handleSend(q)} disabled={isSending}>{q}</button>
            ))}
          </div>

          <div className="az-ai-footer">
            <label className="az-auto-approve">
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
              自動核准所有動作
            </label>
            <div className="az-ai-input-row">
              <button className="az-ai-attach">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
              </button>
              <textarea
                className="az-ai-textarea"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="向 AI 詢問旅程規劃..."
              />
              <button className="az-ai-send" onClick={() => handleSend()} disabled={isSending || !input.trim()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9 22,2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
