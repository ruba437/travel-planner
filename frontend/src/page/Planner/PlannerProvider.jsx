import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';

// 建立 Context
const PlannerContext = createContext();

// 常數定義
export const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const DEFAULT_DAY_START_TIME = '09:00';
const CHECKLIST_LIMIT = 50;
const AUTO_SAVE_DEBOUNCE_MS = 1500;

const normalizeChecklistItems = (items = []) => {
  if (!Array.isArray(items)) return [];

  return [...items]
    .map((item, index) => {
      const sortOrderValue = Number(item?.sortOrder);
      return {
        ...item,
        sortOrder: Number.isFinite(sortOrderValue) ? Math.max(0, sortOrderValue) : index,
      };
    })
    .sort((a, b) => {
      const sortDiff = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
      if (sortDiff !== 0) return sortDiff;
      return String(a.id).localeCompare(String(b.id));
    })
    .map((item, index) => ({
      ...item,
      sortOrder: index,
    }))
    .slice(0, CHECKLIST_LIMIT);
};

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

export const PlannerProvider = ({ children, isPublicMode = false }) => {
  const { token } = useAuth();
  const { uuid: itineraryUuidParam, guideSlug: publicGuideSlug } = useParams();
  const navigate = useNavigate();

  // --- 狀態管理 (States) ---
  const [plan, setPlan] = useState(null);
  const [messages, setMessages] = useState([{ role: 'assistant', content: '嗨，我是旅遊小助手！我可以幫你安排行程。' }]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeLocation, setActiveLocation] = useState(null);
  const [weatherData] = useState(null);
  const [totalBudget, setTotalBudget] = useState(50000);
  const [itineraryUuid, setItineraryUuid] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoadingItinerary, setIsLoadingItinerary] = useState(false);
  const [activeTab, setActiveTab] = useState('itinerary');
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [packingItems, setPackingItems] = useState([]);
  const [tripNote, setTripNote] = useState('');
  const [isChecklistSyncing, setIsChecklistSyncing] = useState(false);
  const [isAutoGeneratingChecklist, setIsAutoGeneratingChecklist] = useState(false);
  const [autoChecklistError, setAutoChecklistError] = useState(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const autoSaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef('');

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
      const res = await fetch(`${API_BASE}/api/places/directions`, {
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
        const itemMode = newItems[i - 1].travelMode || mode;
        travelTime = await fetchTravelTime(newItems[i - 1], item, itemMode);
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

  // ========== 公開模式：載入公開行程 ==========
  useEffect(() => {
    if (!isPublicMode || !publicGuideSlug) return;
    
    setIsLoadingItinerary(true);
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/guides/${encodeURIComponent(publicGuideSlug)}/itinerary`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error(`無法載入公開行程：${res.status}`);
        }

        const data = await res.json();
        if (!data.success || !data.data) {
          throw new Error('公開行程資料格式錯誤');
        }

        const publicData = data.data;
        const itineraryData = publicData.itineraryData || {};

        const loadedPlan = {
          tripName: publicData.title || '',
          summary: publicData.summary || '',
          city: publicData.city || '',
          startDate: publicData.startDate || '',
          startTime: publicData.startTime || '09:00',
          note: publicData.note || '',
          days: Array.isArray(itineraryData.days) ? itineraryData.days : [],
          totalBudget: itineraryData.totalBudget || 50000,
          tags: itineraryData.tags || [],
          // 公開行程來源資訊
          sourceAuthor: publicData.author,
          downloadsCount: publicData.downloadsCount,
          publishedAt: publicData.publishedAt,
        };

        setPlan(loadedPlan);
        setItineraryUuid(publicData.uuid);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Load public itinerary error:', error);
          alert('無法載入公開行程：' + error.message);
        }
      } finally {
        setIsLoadingItinerary(false);
      }
    })();

    return () => controller.abort();
  }, [isPublicMode, publicGuideSlug]);

  // ========== 私有模式：載入既有行程 ==========
  useEffect(() => {
    if (isPublicMode || !itineraryUuidParam) return;

    const controller = new AbortController();
    setIsLoadingItinerary(true);

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/itineraries/${encodeURIComponent(itineraryUuidParam)}`, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `無法載入行程：${res.status}`);
        }

        const data = await res.json();
        const itineraryData = data.itineraryData || {};
        const days = Array.isArray(itineraryData.days) ? itineraryData.days : [];
        const loadedPackingItems = Array.isArray(data.checklistItems) && data.checklistItems.length > 0
          ? data.checklistItems
          : Array.isArray(itineraryData.packingItems)
            ? itineraryData.packingItems
            : [];

        setPlan({
          ...itineraryData,
          tripName: data.title || itineraryData.tripName || data.city || '我的行程',
          summary: data.summary || itineraryData.summary || '',
          city: data.city || itineraryData.city || '',
          startDate: data.startDate || itineraryData.startDate || '',
          startTime: data.startTime || itineraryData.startTime || '09:00',
          days,
          totalBudget: itineraryData.totalBudget || 50000,
        });
        setPackingItems(normalizeChecklistItems(loadedPackingItems));
        setTotalBudget(itineraryData.totalBudget || 50000);
        setTripNote(data.tripNote || itineraryData.tripNote || '');
        setItineraryUuid(data.uuid || itineraryUuidParam);
        setMessages([{ role: 'assistant', content: '行程已載入，可以開始編輯。' }]);
        setActiveDayIdx(0);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Load itinerary error:', error);
          setSaveMsg(error.message || '載入行程失敗');
        }
      } finally {
        setIsLoadingItinerary(false);
      }
    })();

    return () => controller.abort();
  }, [isPublicMode, itineraryUuidParam, token]);

  // 4. 儲存行程邏輯
  const persistencePayload = useMemo(() => {
    if (!plan) return null;

    const nextPackingItems = normalizeChecklistItems(packingItems);
    return {
      title: plan.tripName || plan.city || '我的行程',
      itineraryData: { ...plan, totalBudget, packingItems: nextPackingItems },
      tripNote,
      checklistItems: nextPackingItems,
      startDate: plan.startDate,
      startTime: plan.startTime,
    };
  }, [plan, totalBudget, packingItems, tripNote]);

  const persistenceSnapshot = useMemo(() => {
    if (!persistencePayload) return '';
    return JSON.stringify(persistencePayload);
  }, [persistencePayload]);

  const saveItinerary = useCallback(async ({ silent = false, packingItems: packingItemsOverride } = {}) => {
    if (!plan) return false;
    const nextPackingItems = normalizeChecklistItems(packingItemsOverride ?? packingItems);
    const payload = {
      ...(persistencePayload || {
        title: plan.tripName || plan.city || '我的行程',
        itineraryData: { ...plan, totalBudget, packingItems: nextPackingItems },
        tripNote,
        checklistItems: nextPackingItems,
        startDate: plan.startDate,
        startTime: plan.startTime,
      }),
      itineraryData: {
        ...(persistencePayload?.itineraryData || plan),
        totalBudget,
        packingItems: nextPackingItems,
      },
      checklistItems: nextPackingItems,
    };
    
    // 公開模式：調用保存公開行程的 API
    if (isPublicMode && publicGuideSlug) {
      setIsSaving(true);
      try {
        const res = await fetch(`${API_BASE}/api/guides/${encodeURIComponent(publicGuideSlug)}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || '保存失敗');
        }

        const data = await res.json();
        if (data.success && data.data?.newUuid) {
          // 成功保存後導向可編輯的專有行程
          navigate(`/planner/${data.data.newUuid}`, { replace: true });
          return true;
        }
        throw new Error(data.error || '保存失敗');
      } catch (e) {
        console.error('Save public itinerary error:', e);
        setSaveMsg('保存失敗：' + e.message);
        return false;
      } finally {
        setIsSaving(false);
      }
    }

    // 私有模式：保存到使用者自己的行程
    if (!silent) {
      setIsSaving(true);
    }

    try {
      const method = itineraryUuid ? 'PUT' : 'POST';
      const url = `${API_BASE}/api/itineraries${itineraryUuid ? `/${itineraryUuid}` : ''}`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Save failed');
      }

      const data = await res.json();
      if (data.uuid && !itineraryUuid) {
        setItineraryUuid(data.uuid);
        navigate(`/planner/${data.uuid}`, { replace: true });
      }

      lastSavedSnapshotRef.current = JSON.stringify(payload);
      setHasUnsavedChanges(false);

      if (!silent) {
        setSaveMsg('已保存');
        setTimeout(() => setSaveMsg(null), 2000);
      }
      return true;
    } catch (e) {
      if (!silent) {
        setSaveMsg('保存失敗：' + (e.message || '未知錯誤'));
      }
      return false;
    } finally {
      if (!silent) {
        setIsSaving(false);
      }
    }
  }, [plan, totalBudget, packingItems, tripNote, persistencePayload, itineraryUuid, token, navigate, isPublicMode, publicGuideSlug]);

  useEffect(() => {
    if (isPublicMode || isLoadingItinerary) return;
    if (!persistencePayload || !persistenceSnapshot || !token) return;

    if (itineraryUuid && !lastSavedSnapshotRef.current) {
      lastSavedSnapshotRef.current = persistenceSnapshot;
      setHasUnsavedChanges(false);
      return;
    }

    const dirty = persistenceSnapshot !== lastSavedSnapshotRef.current;
    setHasUnsavedChanges(dirty);

    if (!dirty) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      if (isSaving || isAutoSaving || isChecklistSyncing || isAutoGeneratingChecklist) return;

      setIsAutoSaving(true);
      const success = await saveItinerary({ silent: true });
      if (!success) {
        setSaveMsg('自動保存失敗，將在下次變更時重試');
      }
      setIsAutoSaving(false);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    saveItinerary,
    persistencePayload,
    persistenceSnapshot,
    token,
    itineraryUuid,
    isPublicMode,
    isLoadingItinerary,
    isSaving,
    isAutoSaving,
    isChecklistSyncing,
    isAutoGeneratingChecklist,
  ]);

  useEffect(() => {
    if (isPublicMode || !hasUnsavedChanges) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isPublicMode, hasUnsavedChanges]);

  useEffect(() => {
    if (isPublicMode) return;
    if (itineraryUuidParam) return;
    if (isLoadingItinerary) return;

    if (!plan) {
      lastSavedSnapshotRef.current = '';
      setHasUnsavedChanges(false);
    }
  }, [isPublicMode, itineraryUuidParam, isLoadingItinerary, plan]);

  const generateChecklist = useCallback(async ({ silent = false, replaceExisting = false } = {}) => {
    if (!itineraryUuid || isPublicMode) return { success: false, skipped: true };
    if (!token) {
      const message = '登入資訊尚未就緒，請稍後再試';
      setAutoChecklistError(message);
      if (!silent) {
        setSaveMsg(message);
        setTimeout(() => setSaveMsg(null), 2500);
      }
      return { success: false, error: message };
    }

    setIsChecklistSyncing(true);
    setIsAutoGeneratingChecklist(true);
    setAutoChecklistError(null);

    try {
      const res = await fetch(`${API_BASE}/api/itineraries/${encodeURIComponent(itineraryUuid)}/generate-checklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPlan: plan, replaceExisting }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '生成行前清單失敗');

      const nextItems = normalizeChecklistItems(Array.isArray(data.checklistItems) ? data.checklistItems : []);
      setPackingItems(nextItems);

      if (!silent) {
        const nextMessage = replaceExisting
          ? `已重新生成 ${nextItems.length} 項旅行準備`
          : (data.addedCount > 0 ? `已補齊 ${data.addedCount} 項旅行準備` : '目前清單已齊全');
        setSaveMsg(nextMessage);
        setTimeout(() => setSaveMsg(null), 2200);
      }

      return { success: true, addedCount: Number(data.addedCount) || 0, checklistItems: nextItems };
    } catch (error) {
      const message = error?.message || '生成行前清單失敗';
      setAutoChecklistError(message);
      if (!silent) {
        setSaveMsg(message);
        setTimeout(() => setSaveMsg(null), 3000);
      }
      return { success: false, error: message };
    } finally {
      setIsChecklistSyncing(false);
      setIsAutoGeneratingChecklist(false);
    }
  }, [itineraryUuid, isPublicMode, token, plan]);

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
    hasUnsavedChanges,
    isLoadingItinerary,
    activeLocation, setActiveLocation,
    weatherData,
    handleSend,
    saveItinerary,
    recalculateDayTimesAsync,
    fetchTravelTime,
    autoApprove, setAutoApprove,
    token,
    isChecklistSyncing, setIsChecklistSyncing,
    isAutoGeneratingChecklist,
    autoChecklistError,
    setAutoChecklistError,
    generateChecklist,
    setSaveMsg,
    isPublicMode,
  };

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
};

export const usePlanner = () => {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used within a PlannerProvider');
  return context;
};