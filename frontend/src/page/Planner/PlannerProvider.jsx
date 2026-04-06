import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';

// 建立 Context
const PlannerContext = createContext();

// 常數定義
export const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
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
  const [autoApprove, setAutoApprove] = useState(false);

  // --- 核心邏輯 (Functions) ---

  // 1. 取得交通時間 (🚀 強化防禦：防止 400 錯誤)
  const fetchTravelTime = useCallback(async (originItem, destItem, mode = 'TRANSIT') => {
    if (!originItem || !destItem) return 15;
    
    const getPayload = (item) => {
      // 優先檢查是否有經緯度物件
      if (item.location?.lat && item.location?.lng) {
        return { lat: item.location.lat, lng: item.location.lng };
      }
      // 若無座標，檢查名稱是否有效
      const name = item.name?.trim();
      if (!name || ['自由活動', '休息', '回飯店', '交通', '捷運', '搭乘'].some(k => name.includes(k))) {
        return null;
      }
      return name;
    };

    const origin = getPayload(originItem);
    const dest = getPayload(destItem);

    // 💡 如果起點或終點資料不全，直接回傳預設 15 分鐘，不發送 API 請求
    if (!origin || !dest) return 15;

    // 額外座標檢查
    if (typeof origin === 'object' && (!origin.lat || !origin.lng)) return 15;
    if (typeof dest === 'object' && (!dest.lat || !dest.lng)) return 15;

    try {
      const res = await fetch(`${API_BASE}/api/directions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ origin, destination: dest, mode })
      });
      
      if (!res.ok) return 15; // 即使 API 回傳 400/500 也保底 15 分鐘

      const data = await res.json();
      if (data.routes?.length > 0) {
        const durationSeconds = data.routes[0].legs[0].duration.value;
        // 以 15 分鐘為單位進位
        return Math.ceil(Math.ceil(durationSeconds / 60) / 15) * 15 || 15;
      }
    } catch (e) { 
      console.warn("Direction calculation skipped:", e.message); 
    }
    return 15;
  }, [token]);

  // 2. 重新計算全天時間 (非同步處理)
  const recalculateDayTimesAsync = useCallback(async (items, dayStartTime = '09:00', mode = 'TRANSIT') => {
    if (!items || items.length === 0) return items;
    let currentStartTime = normalizeTimeValue(dayStartTime);
    const newItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = { ...items[i] };
      
      // 計算交通時間 (從第二個景點開始算)
      let travelTime = 0;
      if (i > 0) {
        travelTime = await fetchTravelTime(newItems[i - 1], item, mode);
      }

      // 將當前起始時間加上交通時間
      const [currH, currM] = currentStartTime.split(':').map(Number);
      const arrivalDate = new Date();
      arrivalDate.setHours(currH, currM + travelTime, 0, 0);
      const startTimeStr = `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}`;

      // 停留時間預設 120 分鐘
      let durationMinutes = 120;
      const [startH, startM] = startTimeStr.split(':').map(Number);
      const assignedEndDate = new Date();
      assignedEndDate.setHours(startH, startM + durationMinutes, 0, 0);
      const endTimeStr = `${String(assignedEndDate.getHours()).padStart(2, '0')}:${String(assignedEndDate.getMinutes()).padStart(2, '0')}`;
      
      item.time = `${startTimeStr}~${endTimeStr}`;
      newItems.push(item);
      
      // 更新下一個景點的起算點
      currentStartTime = endTimeStr;
    }
    return newItems;
  }, [fetchTravelTime]);

  // 3. AI 發送訊息與行程同步
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
      if (!res.ok || data.error) throw new Error(data.error || 'AI 請求失敗');

      if (data.plan) {
        const nextPlan = { ...data.plan };
        if (nextPlan.days && Array.isArray(nextPlan.days)) {
          // 對 AI 回傳的每一天進行過濾與時間重算
          nextPlan.days = await Promise.all(
            nextPlan.days.map(async (day) => {
              const validItems = (day.items || []).filter(item => item && item.name?.trim());
              const dayStartTime = day.startTime || '09:00';
              const mode = day.transportMode || 'TRANSIT';
              
              const recalculatedItems = await recalculateDayTimesAsync(validItems, dayStartTime, mode);
              return { ...day, items: recalculatedItems };
            })
          );
        }
        setPlan(nextPlan);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || '行程已根據您的需求更新。' }]);
    } catch (e) {
      console.error("AI Chat Error:", e);
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，系統目前忙碌中，請稍後再試。' }]);
    } finally {
      setIsSending(false);
    }
  };

  // 4. 儲存行程邏輯
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

  // --- 提供給子組件的 Context Value ---
  const value = {
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
    handleSend,
    saveItinerary,
    recalculateDayTimesAsync,
    fetchTravelTime,
    autoApprove, setAutoApprove,
  };

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
};

export const usePlanner = () => {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used within a PlannerProvider');
  return context;
};