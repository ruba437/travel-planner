import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
const CHECKLIST_LIMIT = 10;
const CHECKLIST_TEXT_MAX_LENGTH = 800;
const DEFAULT_CHECKLIST = [];

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

const normalizeChecklistItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, idx) => {
      const text = String(item?.text || '').trim();
      if (!text) return null;
      return {
        id: item?.id ?? `local-${Date.now()}-${idx}`,
        text,
        checked: Boolean(item?.checked),
        reminder: Boolean(item?.reminder),
        sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : idx,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, CHECKLIST_LIMIT)
    .map((item, idx) => ({ ...item, sortOrder: idx }));
};

function App() {
  const { user, token, logout } = useAuth();
  const { uuid: itineraryUuidParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hasAppliedPrefill = useRef(false);

  const [messages, setMessages] = useState([
    { role: 'assistant', content: '嗨，我是旅遊小助手！我可以幫你安排行程。' },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [plan, setPlan] = useState(null);
  const [activeLocation, setActiveLocation] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [totalBudget, setTotalBudget] = useState(50000);
  const [itineraryUuid, setItineraryUuid] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
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
  const [isAddingItem, setIsAddingItem] = useState(false); // NEW: tracks if inline add row is open
  const [isEditingHero, setIsEditingHero] = useState(false);
  const [tripNameInput, setTripNameInput] = useState('');
  const [tripStartDateInput, setTripStartDateInput] = useState('');
  const [tripStartTimeInput, setTripStartTimeInput] = useState(DEFAULT_DAY_START_TIME);
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editingChecklistText, setEditingChecklistText] = useState('');
  const [isChecklistSyncing, setIsChecklistSyncing] = useState(false);
  const autoSaveTimerRef = useRef(null);
  const lastSavedKeyRef = useRef('');
  const chatEndRef = useRef(null);
  const addInputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (itineraryUuidParam) loadItinerary(itineraryUuidParam);
  }, [itineraryUuidParam]);

  // Auto-focus the add input when opened
  useEffect(() => {
    if (isAddingItem && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAddingItem]);

  const fetchTravelTime = async (originItem, destItem, token, mode = 'TRANSIT') => {
  if (!originItem || !destItem) return 15; // 找不到資料退回 15 分鐘

  const getPayload = (item) => {
    if (item.location && item.location.lat && item.location.lng) {
      return { lat: item.location.lat, lng: item.location.lng };
    }
    if (item.name && typeof item.name === 'string' && item.name.trim() !== '') {
      const name = item.name.trim();
      if (['自由活動', '休息', '回飯店'].includes(name)) return null;
      return name;
    }
    return null;
  };

  const originPayload = getPayload(originItem);
  const destPayload = getPayload(destItem);

  if (!originPayload || !destPayload) return 15; // 預設 15 分鐘

  try {
    const res = await fetch(`${API_BASE}/api/directions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({
        origin: originPayload,
        destination: destPayload,
        mode
      })
    });
    
    if (!res.ok) return 15; // 發生 400 錯誤等狀況，退回 15 分鐘
    
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const durationSeconds = data.routes[0].legs[0].duration.value;
      const rawMinutes = Math.ceil(durationSeconds / 60);
      
      // 以 15 分鐘為單位進位
      let roundedMinutes = Math.ceil(rawMinutes / 15) * 15;
      if (roundedMinutes === 0) roundedMinutes = 15;

      return roundedMinutes;
    }
  } catch (error) {
    console.warn(`[交通時間計算] 無法取得時間: ${error.message}`);
  }
  
  return 15; // 最終保底 15 分鐘
};

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
        setPackingItems(normalizeChecklistItems(rawChecklist));

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

  const saveItinerary = useCallback(async ({ silent = false, syncChecklist = true } = {}) => {
    if (!plan) return false;
    setIsSaving(true);
    if (!silent) setSaveMsg(null);

    const cleanedTripName = (plan.tripName || '').trim();
    const checklistPayload = normalizeChecklistItems(packingItems).map((item, idx) => ({
      id: item.id,
      text: item.text,
      checked: Boolean(item.checked),
      reminder: Boolean(item.reminder),
      sortOrder: idx,
    }));

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
      const targetUuid = data.uuid || itineraryUuid;
      if (data.uuid) {
        setItineraryUuid(data.uuid);
        navigate(`/planner/${data.uuid}`, { replace: true });
      }

      if (syncChecklist && targetUuid) {
        try {
          setIsChecklistSyncing(true);
          const checklistRes = await fetch(`${API_BASE}/api/itineraries/${targetUuid}/checklist`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (checklistRes.ok) {
            const checklistData = await checklistRes.json();
            if (Array.isArray(checklistData.checklistItems)) {
              setPackingItems(normalizeChecklistItems(checklistData.checklistItems));
            }
          }
        } catch (syncErr) {
          console.error('Checklist refresh failed after save:', syncErr);
        } finally {
          setIsChecklistSyncing(false);
        }
      }

      if (!silent) {
        setSaveMsg('已保存');
        setTimeout(() => setSaveMsg(null), 2000);
      }
      return true;
    } catch (err) {
      console.error(err);
      if (!silent) {
        setSaveMsg('保存失敗');
        setTimeout(() => setSaveMsg(null), 3000);
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [plan, packingItems, tripNote, totalBudget, itineraryUuid, token, navigate]);

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
        data.plan.days = await Promise.all(
          data.plan.days.map(async (day) => {
            const validItems = (day.items || []).filter(item => {
              if (!item.name) return false;
              const blockList = ['捷運', '回到住宿', '休息', '搭乘', '前往', '步行至', '交通'];
              const isBlocked = blockList.some(keyword => item.name.includes(keyword));
              const isBracketTransit = item.name.startsWith('[') && (item.name.includes('至') || item.name.includes('回'));
              return !isBlocked && !isBracketTransit; 
            });

            // 👉 1. 設定每日的起始時間 (保留日後可擴充的彈性)
            // 如果 AI 有傳 startTime 就用，沒有的話就強制預設 09:00
            const dayStartTime = day.startTime || '09:00';
            const mode = day.transportMode || 'TRANSIT'; 
            const recalculatedItems = await recalculateDayTimesAsync(validItems, dayStartTime, token, mode);
            return { 
              ...day, 
              startTime: dayStartTime, 
              transportMode: mode, 
              items: recalculatedItems 
            };
          })
        );
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

  const autoSaveKey = useMemo(() => {
    if (!plan) return '';
    const checklistPayload = normalizeChecklistItems(packingItems).map((item, idx) => ({
      id: item.id,
      text: item.text,
      checked: Boolean(item.checked),
      reminder: Boolean(item.reminder),
      sortOrder: idx,
    }));

    return JSON.stringify({
      itineraryUuid: itineraryUuid || null,
      tripName: (plan.tripName || '').trim(),
      summary: plan.summary || '',
      city: plan.city || '',
      startDate: plan.startDate || null,
      startTime: normalizeTimeValue(plan.startTime, DEFAULT_DAY_START_TIME),
      days: plan.days || [],
      tripNote: tripNote || '',
      totalBudget: Number(totalBudget) || 0,
      checklist: checklistPayload,
    });
  }, [plan, itineraryUuid, tripNote, totalBudget, packingItems]);

  useEffect(() => {
    if (!plan || !token || isLoadingItinerary || isChecklistSyncing || isSaving) return;
    if (!autoSaveKey) return;

    if (itineraryUuid && !lastSavedKeyRef.current) {
      lastSavedKeyRef.current = autoSaveKey;
      return;
    }

    if (autoSaveKey === lastSavedKeyRef.current) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setIsAutoSaving(true);
      const ok = await saveItinerary({ silent: true, syncChecklist: false });
      if (ok) {
        lastSavedKeyRef.current = autoSaveKey;
        setSaveMsg('已保存');
        setTimeout(() => setSaveMsg(null), 1200);
      } else {
        setSaveMsg('保存失敗');
        setTimeout(() => setSaveMsg(null), 2500);
      }
      setIsAutoSaving(false);
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSaveKey, plan, token, itineraryUuid, isLoadingItinerary, isChecklistSyncing, isSaving, saveItinerary]);

  useEffect(() => () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
  }, []);

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

  const handleAddLocationFromMap = async (locationData) => {
    if (!plan || !plan.days || plan.days.length === 0 || locationData.targetDayIndex === undefined) {
      alert('請先讓 AI 產生一個基本的行程，才能手動加入景點喔！');
      return;
    }
    const targetDayIdx = locationData.targetDayIndex;
    const newPlan = { ...plan, days: [...plan.days] };
    const dayItems = [...(plan.days[targetDayIdx].items || [])];
    dayItems.push({ name: locationData.name, type: locationData.type || 'sight', time: '', cost: 0, note: `手動從地圖加入 (第 ${targetDayIdx + 1} 天)`, location: { lat: locationData.lat, lng: locationData.lng } });
    newPlan.days[targetDayIdx] = { ...plan.days[targetDayIdx], items: await recalculateDayTimesAsync(dayItems, getTrueStartTime(targetDayIdx)) };
    setPlan(newPlan);
    setActiveLocation({ day: targetDayIdx + 1, order: dayItems.length - 1 });
  };

  const updateActivityTime = async (dayIdx, itemIdx, newTime) => {
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
        const mode = newPlan.days[dayIdx].transportMode || 'TRANSIT';
        const travelTime = await fetchTravelTime(newItems[i - 1], nextItem, token, mode);

        const [currH, currM] = currentEndTime.split(':').map(Number);
        const startDate = new Date(); 
        startDate.setHours(currH, currM + travelTime, 0, 0); // 這裡替換掉原來的 30
        
        const newStartStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
        const endDate = new Date(startDate); 
        endDate.setMinutes(endDate.getMinutes() + nextDuration);
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
  const checklistDoneCount = packingItems.filter((item) => item.checked).length;
  const checklistUsageText = `${checklistDoneCount}/${CHECKLIST_LIMIT}`;
  const checklistIsFull = packingItems.length >= CHECKLIST_LIMIT;
  const checklistPendingCount = packingItems.length - checklistDoneCount;
  const checklistAllChecked = packingItems.length > 0 && checklistDoneCount === packingItems.length;
  const checklistHasCheckedItems = checklistDoneCount > 0;
  const checklistProgressPercent = packingItems.length === 0
    ? 0
    : Math.round((checklistDoneCount / packingItems.length) * 100);

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

  const recalculateDayTimesAsync = async (items, dayStartTime = '09:00', token, mode = 'TRANSIT') => {
    if (!items || items.length === 0) return items;
    
    let currentStartTime = dayStartTime;
    const newItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = { ...items[i] };
      
      // 計算交通時間（第一個行程不用加上交通時間）
      let travelTime = 0;
      if (i > 0) {
        const prevItem = newItems[i - 1];
        travelTime = await fetchTravelTime(prevItem, item, token, mode);
      }

      // 將抵達時間往後推 travelTime 分鐘
      if (i > 0) {
        const [currH, currM] = currentStartTime.split(':').map(Number);
        const arrivalDate = new Date(); 
        arrivalDate.setHours(currH, currM + travelTime, 0, 0);
        currentStartTime = `${arrivalDate.getHours().toString().padStart(2, '0')}:${arrivalDate.getMinutes().toString().padStart(2, '0')}`;
      }

      // 計算停留時間 (預設 120 分鐘)
      let durationMinutes = 120;
      if (item.time && item.time.includes('~')) {
        const [oldStart, oldEnd] = item.time.split('~');
        const [sH, sM] = oldStart.split(':').map(Number); 
        const [eH, eM] = oldEnd.split(':').map(Number);
        if (!isNaN(sH) && !isNaN(eH)) { 
          durationMinutes = (eH * 60 + eM) - (sH * 60 + sM); 
          if (durationMinutes <= 0) durationMinutes = 120; 
        }
      }

      const assignedStartTime = currentStartTime;
      const [startH, startM] = assignedStartTime.split(':').map(Number);
      const assignedEndDate = new Date(); 
      assignedEndDate.setHours(startH, startM + durationMinutes, 0, 0);
      const assignedEndTime = `${assignedEndDate.getHours().toString().padStart(2, '0')}:${assignedEndDate.getMinutes().toString().padStart(2, '0')}`;
      
      item.time = `${assignedStartTime}~${assignedEndTime}`;
      newItems.push(item);
      
      // 下一個行程的起算時間
      currentStartTime = assignedEndTime;
    }
    
    return newItems;
  };

  const onDragEnd = async (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const newPlan = { ...plan };
    const sourceDayIdx = parseInt(source.droppableId.split('-')[1], 10);
    const destDayIdx = parseInt(destination.droppableId.split('-')[1], 10);
    const destDayStartTime = newPlan.days[destDayIdx].startTime || '09:00';
    const sourceDayStartTime = newPlan.days[sourceDayIdx].startTime || '09:00';
    const sourceItems = Array.from(newPlan.days[sourceDayIdx].items);
    const destItems = sourceDayIdx === destDayIdx ? sourceItems : Array.from(newPlan.days[destDayIdx].items);
    const [movedItem] = sourceItems.splice(source.index, 1);
    const sourceMode = newPlan.days[sourceDayIdx].transportMode || 'TRANSIT';
    const destMode = newPlan.days[destDayIdx].transportMode || 'TRANSIT';
    destItems.splice(destination.index, 0, movedItem);
    if (sourceDayIdx === destDayIdx) {
      newPlan.days[sourceDayIdx].items = await recalculateDayTimesAsync(sourceItems, sourceDayStartTime, token, sourceMode);
    } else {
      newPlan.days[sourceDayIdx].items = await recalculateDayTimesAsync(sourceItems, sourceDayStartTime, token, sourceMode);
      newPlan.days[destDayIdx].items = await recalculateDayTimesAsync(destItems, destDayStartTime, token, destMode);
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

  const handleHeroEditSave = async () => {
    if (!plan) {
      setIsEditingHero(false);
      return;
    }
    const nextTripName = tripNameInput.trim();
    const nextStartDate = tripStartDateInput || null;
    const nextStartTime = normalizeTimeValue(tripStartTimeInput, normalizeTimeValue(plan.startTime, DEFAULT_DAY_START_TIME));
    
    // 2. 處理非同步的 days 計算
    let nextDays = plan.days;
    
    if (Array.isArray(plan.days)) {
      nextDays = await Promise.all(
        plan.days.map(async (day) => {
          // 👉 取得該天專屬的出發時間，如果沒有才退回行程預設時間或 09:00
          const dayStartTime = day.startTime || nextStartTime || '09:00';
          
          const recalculatedItems = await recalculateDayTimesAsync(day.items || [], dayStartTime, token);
          return { 
            ...day, 
            startTime: dayStartTime, 
            items: recalculatedItems 
          };
        })
      );
    }

    setPlan({
      ...plan,
      tripName: nextTripName,
      startDate: nextStartDate,
      startTime: nextStartTime,
      days: nextDays,
    });
    setIsEditingHero(false);
  };

  const isPersistedChecklistItem = (itemId) => itineraryUuid && Number.isFinite(Number(itemId));

  const setChecklistError = (message) => {
    setSaveMsg(message || '行前清單更新失敗');
    setTimeout(() => setSaveMsg(null), 2500);
  };

  const requestChecklistApi = async (path = '', options = {}, targetUuid = itineraryUuid) => {
    if (!targetUuid) throw new Error('請先儲存行程後再同步清單');

    const res = await fetch(`${API_BASE}/api/itineraries/${targetUuid}/checklist${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '行前清單同步失敗');
    return data;
  };

  const addChecklistItem = async () => {
    const text = newChecklistText.trim().slice(0, CHECKLIST_TEXT_MAX_LENGTH);
    if (!text) {
      setIsAddingItem(false);
      return;
    }
    if (packingItems.length >= CHECKLIST_LIMIT) {
      setChecklistError(`行前清單最多 ${CHECKLIST_LIMIT} 項`);
      return;
    }

    const draftItem = {
      id: `local-${Date.now()}`,
      text,
      checked: false,
      reminder: false,
      sortOrder: packingItems.length,
    };

    if (!itineraryUuid) {
      setPackingItems((prev) => normalizeChecklistItems([...prev, draftItem]));
      setNewChecklistText('');
      setIsAddingItem(false);
      return;
    }

    setIsChecklistSyncing(true);
    try {
      const data = await requestChecklistApi('', {
        method: 'POST',
        body: JSON.stringify({ text, checked: false, reminder: false, sortOrder: packingItems.length }),
      });
      setPackingItems((prev) => normalizeChecklistItems([...prev, data.item]));
      setNewChecklistText('');
      setIsAddingItem(false);
    } catch (err) {
      console.error(err);
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const cancelAddItem = () => {
    setNewChecklistText('');
    setIsAddingItem(false);
  };

  const toggleChecklistChecked = async (id) => {
    let nextChecked = false;
    setPackingItems((prev) => normalizeChecklistItems(
      prev.map((item) => {
        if (item.id !== id) return item;
        nextChecked = !item.checked;
        return { ...item, checked: nextChecked };
      })
    ));

    if (!isPersistedChecklistItem(id)) return;

    setIsChecklistSyncing(true);
    try {
      const data = await requestChecklistApi(`/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ checked: nextChecked }),
      });
      setPackingItems((prev) => normalizeChecklistItems(
        prev.map((item) => item.id === id ? { ...item, ...data.item } : item)
      ));
    } catch (err) {
      console.error(err);
      setPackingItems((prev) => normalizeChecklistItems(
        prev.map((item) => item.id === id ? { ...item, checked: !nextChecked } : item)
      ));
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const toggleChecklistReminder = async (id) => {
    let nextReminder = false;
    setPackingItems((prev) => normalizeChecklistItems(
      prev.map((item) => {
        if (item.id !== id) return item;
        nextReminder = !item.reminder;
        return { ...item, reminder: nextReminder };
      })
    ));

    if (!isPersistedChecklistItem(id)) return;

    setIsChecklistSyncing(true);
    try {
      const data = await requestChecklistApi(`/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ reminder: nextReminder }),
      });
      setPackingItems((prev) => normalizeChecklistItems(
        prev.map((item) => item.id === id ? { ...item, ...data.item } : item)
      ));
    } catch (err) {
      console.error(err);
      setPackingItems((prev) => normalizeChecklistItems(
        prev.map((item) => item.id === id ? { ...item, reminder: !nextReminder } : item)
      ));
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const removeChecklistItem = async (id) => {
    const removed = packingItems.find((item) => item.id === id);
    if (!removed) return;

    setPackingItems((prev) => normalizeChecklistItems(prev.filter((item) => item.id !== id)));

    if (!isPersistedChecklistItem(id)) return;

    setIsChecklistSyncing(true);
    try {
      await requestChecklistApi(`/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error(err);
      setPackingItems((prev) => normalizeChecklistItems([...prev, removed]));
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const startEditChecklist = (id, text) => {
    setEditingChecklistId(id);
    setEditingChecklistText(text);
  };

  const saveEditChecklist = async (id) => {
    const text = editingChecklistText.trim().slice(0, CHECKLIST_TEXT_MAX_LENGTH);
    const originalText = packingItems.find((item) => item.id === id)?.text || '';

    if (!text) {
      setEditingChecklistId(null);
      setEditingChecklistText('');
      await removeChecklistItem(id);
      return;
    }

    setPackingItems((prev) => normalizeChecklistItems(
      prev.map((item) => item.id === id ? { ...item, text } : item)
    ));
    setEditingChecklistId(null);
    setEditingChecklistText('');

    if (!isPersistedChecklistItem(id)) return;

    setIsChecklistSyncing(true);
    try {
      const data = await requestChecklistApi(`/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ text }),
      });
      setPackingItems((prev) => normalizeChecklistItems(
        prev.map((item) => item.id === id ? { ...item, ...data.item } : item)
      ));
    } catch (err) {
      console.error(err);
      setPackingItems((prev) => normalizeChecklistItems(
        prev.map((item) => item.id === id ? { ...item, text: originalText } : item)
      ));
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const cancelEditChecklist = () => {
    setEditingChecklistId(null);
    setEditingChecklistText('');
  };

  const toggleAllChecklistChecked = async () => {
    if (packingItems.length === 0) return;

    const prevItems = packingItems;
    const nextChecked = !checklistAllChecked;
    setPackingItems(normalizeChecklistItems(
      prevItems.map((item) => ({ ...item, checked: nextChecked }))
    ));

    const persistedIds = prevItems
      .map((item) => item.id)
      .filter((itemId) => isPersistedChecklistItem(itemId));

    if (persistedIds.length === 0) return;

    setIsChecklistSyncing(true);
    try {
      const patchResults = await Promise.all(
        persistedIds.map((itemId) => requestChecklistApi(`/${itemId}`, {
          method: 'PATCH',
          body: JSON.stringify({ checked: nextChecked }),
        }))
      );

      const serverMap = new Map(
        patchResults
          .map((result) => result?.item)
          .filter(Boolean)
          .map((item) => [String(item.id), item])
      );

      setPackingItems((prev) => normalizeChecklistItems(
        prev.map((item) => {
          const serverItem = serverMap.get(String(item.id));
          return serverItem ? { ...item, ...serverItem } : item;
        })
      ));
    } catch (err) {
      console.error(err);
      setPackingItems(normalizeChecklistItems(prevItems));
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const clearCompletedChecklistItems = async () => {
    if (!checklistHasCheckedItems) return;

    const prevItems = packingItems;
    const completedItems = prevItems.filter((item) => item.checked);
    const keepItems = prevItems.filter((item) => !item.checked);

    if (editingChecklistId && completedItems.some((item) => item.id === editingChecklistId)) {
      cancelEditChecklist();
    }

    setPackingItems(normalizeChecklistItems(keepItems));

    const persistedDeleteIds = completedItems
      .map((item) => item.id)
      .filter((itemId) => isPersistedChecklistItem(itemId));

    if (persistedDeleteIds.length === 0) return;

    setIsChecklistSyncing(true);
    try {
      await Promise.all(
        persistedDeleteIds.map((itemId) => requestChecklistApi(`/${itemId}`, { method: 'DELETE' }))
      );
    } catch (err) {
      console.error(err);
      setPackingItems(normalizeChecklistItems(prevItems));
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const handleTransportModeChange = async (dayIdx, newMode) => {
    if (!plan) return;
    const newPlan = { ...plan, days: [...plan.days] };
    const day = newPlan.days[dayIdx];

    // 1. 更新該天的交通方式
    day.transportMode = newMode;

    // 2. 依照新的交通方式，重新計算整天的行程時間
    const dayStartTime = day.startTime || '09:00';
    day.items = await recalculateDayTimesAsync(day.items || [], dayStartTime, token, newMode);

    // 3. 更新畫面
    setPlan(newPlan);
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


            {isAutoSaving || isSaving ? '保存中...' : ''}
            {saveMsg && <span className={`az-save-msg ${saveMsg === '已保存' ? 'az-save-msg--ok' : 'az-save-msg--err'}`}>{saveMsg}</span>}

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
                      <path d="M11 4H4a2 2 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
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
                <div className="az-pretrip-card">
                  <div className="az-pretrip-header">
                    <h3 className="az-pretrip-title">旅行準備</h3>
                    <div className="az-pretrip-header-right">
                      <span className="az-pretrip-count">{checklistDoneCount}/{packingItems.length}</span>
                    </div>
                  </div>

                  <div className="az-pretrip-progress-wrap">
                    <div className="az-pretrip-progress">
                      <div className="az-pretrip-progress-bar" style={{ width: `${checklistProgressPercent}%` }} />
                    </div>
                    <span className="az-pretrip-progress-text">已完成 {checklistDoneCount} 項，待辦 {checklistPendingCount} 項</span>
                  </div>

                  {/* ── CHECKLIST LIST (matches screenshot style) ── */}
                  <div className="az-pretrip-list">
                    {packingItems.length === 0 && !isAddingItem && (
                      <div className="az-pretrip-empty">尚未新增項目，先加入第一個行前準備吧。</div>
                    )}

                    {packingItems.map((item) => (
                      <div key={item.id} className={`az-pretrip-row${item.checked ? ' az-pretrip-row--done' : ''}`}>
                        {/* Drag handle */}
                        <div className="az-pretrip-handle" aria-hidden="true">
                          <span /><span /><span /><span /><span /><span />
                        </div>

                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          className="az-pretrip-checkbox"
                          checked={item.checked}
                          onChange={() => toggleChecklistChecked(item.id)}
                          disabled={isChecklistSyncing}
                        />

                        {/* Content */}
                        <div className="az-pretrip-content">
                          {editingChecklistId === item.id ? (
                            <textarea
                              className="az-pretrip-edit-input"
                              value={editingChecklistText}
                              onChange={(e) => setEditingChecklistText(e.target.value)}
                              onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                  e.preventDefault();
                                  saveEditChecklist(item.id);
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelEditChecklist();
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <button
                              type="button"
                              className={`az-pretrip-text${item.checked ? ' is-done' : ''}`}
                              onDoubleClick={() => startEditChecklist(item.id, item.text)}
                              title="雙擊可編輯"
                            >
                              {item.text}
                            </button>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="az-pretrip-actions">
                          {editingChecklistId === item.id ? (
                            <>
                              <button
                                type="button"
                                className="az-pretrip-action az-pretrip-action--save"
                                onClick={() => saveEditChecklist(item.id)}
                                disabled={isChecklistSyncing}
                                aria-label="儲存"
                                title="儲存 (Ctrl+Enter)"
                              >✓</button>
                              <button
                                type="button"
                                className="az-pretrip-action az-pretrip-action--delete"
                                onClick={cancelEditChecklist}
                                disabled={isChecklistSyncing}
                                aria-label="取消"
                                title="取消 (Esc)"
                              >✕</button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={`az-pretrip-action az-pretrip-action--bell${item.reminder ? ' is-active' : ''}`}
                                onClick={() => toggleChecklistReminder(item.id)}
                                disabled={isChecklistSyncing}
                                aria-label={item.reminder ? '取消提醒' : '開啟提醒'}
                                title={item.reminder ? '取消提醒' : '開啟提醒'}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M15 17h5l-1.4-1.4C18.2 15.2 18 14.7 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"/>
                                  <path d="M9 17a3 3 0 0 0 6 0"/>
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="az-pretrip-action az-pretrip-action--delete"
                                onClick={() => removeChecklistItem(item.id)}
                                disabled={isChecklistSyncing}
                                aria-label="刪除項目"
                                title="刪除"
                              >✕</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* ── INLINE ADD ROW (shown when isAddingItem) ── */}
                    {isAddingItem && (
                      <div className="az-pretrip-row az-pretrip-row--adding">
                        <div className="az-pretrip-handle" aria-hidden="true">
                          <span /><span /><span /><span /><span /><span />
                        </div>
                        <input
                          type="checkbox"
                          className="az-pretrip-checkbox"
                          disabled
                          style={{ opacity: 0.3 }}
                        />
                        <div className="az-pretrip-content" style={{ flex: 1 }}>
                          <textarea
                            ref={addInputRef}
                            className="az-pretrip-edit-input az-pretrip-edit-input--new"
                            value={newChecklistText}
                            onChange={(e) => setNewChecklistText(e.target.value)}
                            onKeyDown={(e) => {
                              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                e.preventDefault();
                                addChecklistItem();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelAddItem();
                              }
                            }}
                            placeholder="輸入清單項目..."
                            rows={2}
                          />
                        </div>
                        <div className="az-pretrip-actions">
                          <button
                            type="button"
                            className="az-pretrip-action az-pretrip-action--save"
                            onClick={addChecklistItem}
                            disabled={isChecklistSyncing || !newChecklistText.trim()}
                            title="新增 (Ctrl+Enter)"
                          >✓</button>
                          <button
                            type="button"
                            className="az-pretrip-action az-pretrip-action--delete"
                            onClick={cancelAddItem}
                            title="取消 (Esc)"
                          >✕</button>
                        </div>
                      </div>
                    )}

                    {/* ── ADD ITEM TRIGGER ROW (always visible at bottom) ── */}
                    {!checklistIsFull && !isAddingItem && (
                      <button
                        type="button"
                        className="az-pretrip-add-trigger"
                        onClick={() => setIsAddingItem(true)}
                        disabled={isChecklistSyncing}
                      >
                        <span className="az-pretrip-add-trigger-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        </span>
                        <span className="az-pretrip-add-trigger-label">Add item</span>
                      </button>
                    )}

                    {checklistIsFull && (
                      <div className="az-pretrip-limit-tip">已達上限 {CHECKLIST_LIMIT} 項，請先刪除不需要的項目。</div>
                    )}
                  </div>
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

                            <div className="day-header-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h3 className="az-day-title">Day {dayIdx + 1} {day.date ? `(${day.date})` : ''}</h3>
                              
                              {/* 👉 交通方式切換下拉選單 */}
                              <select 
                                value={day.transportMode || 'TRANSIT'} 
                                onChange={(e) => handleTransportModeChange(dayIdx, e.target.value)}
                                style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
                              >
                                <option value="TRANSIT">🚆 大眾運輸</option>
                                <option value="DRIVING">🚗 開車</option>
                                <option value="WALKING">🚶 步行</option>
                                <option value="BICYCLING">🚲 騎車</option>
                              </select>
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