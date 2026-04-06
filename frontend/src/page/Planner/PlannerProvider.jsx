import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';

// 建立 Context
const PlannerContext = createContext();

// 常數定義 (從原 App.jsx 搬移)
const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const DEFAULT_DAY_START_TIME = '09:00';
const CHECKLIST_LIMIT = 10;

// 輔助函數：時間正規化
const normalizeTimeValue = (value, fallback = DEFAULT_DAY_START_TIME) => {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return fallback;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const PlannerProvider = ({ children }) => {
  const { user, token } = useAuth();
  const { uuid: itineraryUuidParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // --- 狀態管理 (States) ---
  const [plan, setPlan] = useState(null);
  const [messages, setMessages] = useState([{ role: 'assistant', content: '嗨，我是旅遊小助手！我可以幫你安排行程。' }]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeLocation, setActiveLocation] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [totalBudget, setTotalBudget] = useState(50000);
  const [itineraryUuid, setItineraryUuid] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [isLoadingItinerary, setIsLoadingItinerary] = useState(false);
  const [activeTab, setActiveTab] = useState('itinerary');
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [packingItems, setPackingItems] = useState([]);
  const [tripNote, setTripNote] = useState('');
  const [isChecklistSyncing, setIsChecklistSyncing] = useState(false);

  // Refs
  const autoSaveTimerRef = useRef(null);
  const lastSavedKeyRef = useRef('');
  const hasAppliedPrefill = useRef(false);

  // --- 核心邏輯 (Functions) ---

  // 1. 取得交通時間
  const fetchTravelTime = useCallback(async (originItem, destItem, mode = 'TRANSIT') => {
    if (!originItem || !destItem) return 15;
    const getPayload = (item) => {
      if (item.location?.lat && item.location?.lng) return { lat: item.location.lat, lng: item.location.lng };
      if (item.name?.trim()) {
        const name = item.name.trim();
        if (['自由活動', '休息', '回飯店'].includes(name)) return null;
        return name;
      }
      return null;
    };
    const origin = getPayload(originItem);
    const dest = getPayload(destItem);
    if (!origin || !dest) return 15;

    try {
      const res = await fetch(`${API_BASE}/api/directions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ origin, destination: dest, mode })
      });
      if (!res.ok) return 15;
      const data = await res.json();
      if (data.routes?.length > 0) {
        const durationSeconds = data.routes[0].legs[0].duration.value;
        return Math.ceil(Math.ceil(durationSeconds / 60) / 15) * 15 || 15;
      }
    } catch (e) { console.warn(e); }
    return 15;
  }, [token]);

  // 2. 重新計算全天時間
  const recalculateDayTimesAsync = useCallback(async (items, dayStartTime = '09:00', mode = 'TRANSIT') => {
    if (!items || items.length === 0) return items;
    let currentStartTime = dayStartTime;
    const newItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = { ...items[i] };
      let travelTime = i > 0 ? await fetchTravelTime(newItems[i - 1], item, mode) : 0;
      if (i > 0) {
        const [currH, currM] = currentStartTime.split(':').map(Number);
        const arrivalDate = new Date();
        arrivalDate.setHours(currH, currM + travelTime, 0, 0);
        currentStartTime = `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}`;
      }
      let durationMinutes = 120; // 預設停留 2 小時
      const assignedStartTime = currentStartTime;
      const [startH, startM] = assignedStartTime.split(':').map(Number);
      const assignedEndDate = new Date();
      assignedEndDate.setHours(startH, startM + durationMinutes, 0, 0);
      const assignedEndTime = `${String(assignedEndDate.getHours()).padStart(2, '0')}:${String(assignedEndDate.getMinutes()).padStart(2, '0')}`;
      item.time = `${assignedStartTime}~${assignedEndTime}`;
      newItems.push(item);
      currentStartTime = assignedEndTime;
    }
    return newItems;
  }, [fetchTravelTime]);

  // 3. 儲存行程
  const saveItinerary = useCallback(async ({ silent = false } = {}) => {
    if (!plan) return false;
    setIsSaving(true);
    const payload = {
      title: plan.tripName || plan.city || '我的行程',
      itineraryData: { ...plan, totalBudget, packingItems },
      tripNote,
      checklistItems: packingItems,
      startDate: plan.startDate,
      startTime: plan.startTime
    };
    try {
      const method = itineraryUuid ? 'PUT' : 'POST';
      const url = `${API_BASE}/api/itineraries${itineraryUuid ? `/${itineraryUuid}` : ''}`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      if (data.uuid && !itineraryUuid) {
        setItineraryUuid(data.uuid);
        navigate(`/planner/${data.uuid}`, { replace: true });
      }
      if (!silent) {
        setSaveMsg('已保存');
        setTimeout(() => setSaveMsg(null), 2000);
      }
      return true;
    } catch (e) {
      setSaveMsg('保存失敗');
      return false;
    } finally { setIsSaving(false); }
  }, [plan, totalBudget, packingItems, tripNote, itineraryUuid, token, navigate]);

  // 4. AI 發送訊息
  const handleSend = async (quickText) => {
    const text = typeof quickText === 'string' ? quickText.trim() : input.trim();
    if (!text || isSending) return;
    const newHistory = [...messages, { role: 'user', content: text }];
    setMessages(newHistory);
    setInput('');
    setIsSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newHistory, currentPlan: plan })
      });
      const data = await res.json();
      if (data.plan) {
        // 自動重新計算時間邏輯...
        setPlan(data.plan);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || '行程已更新' }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，系統出錯了。' }]);
    } finally { setIsSending(false); }
  };

  // --- 提供給子組件的 Context Value ---
  const value = {
    // States
    plan, setPlan,
    messages, setMessages,
    input, setInput,
    isSending,
    activeDayIdx, setActiveDayIdx,
    activeTab, setActiveTab,
    packingItems, setPackingItems,
    totalBudget, setTotalBudget,
    itineraryUuid,
    showAiPanel, setShowAiPanel,
    sidebarCollapsed, setSidebarCollapsed,
    saveMsg,
    isSaving,
    isAutoSaving,
    isLoadingItinerary,
    activeLocation, setActiveLocation,
    weatherData,

    // Functions
    handleSend,
    saveItinerary,
    recalculateDayTimesAsync,
    fetchTravelTime,
  };

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
};

// 自定義 Hook 方便調用
export const usePlanner = () => {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used within a PlannerProvider');
  return context;
};