import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
    .map((item, index) => ({
      ...item,
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Math.max(0, Number(item.sortOrder)) : index,
    }))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.id).localeCompare(String(b.id)))
    .map((item, index) => ({ ...item, sortOrder: index }))
    .slice(0, CHECKLIST_LIMIT);
};

const normalizeTimeValue = (value, fallback = DEFAULT_DAY_START_TIME) => {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return fallback;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const PlannerProvider = ({ children, isPublicMode = false }) => {
  const { token } = useAuth();
  const { uuid: itineraryUuidParam, guideSlug: publicGuideSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // --- 狀態管理 ---
  const [plan, setPlan] = useState(null);
  const [messages, setMessages] = useState([{ role: 'assistant', content: '嗨，我是旅遊小助手！我可以幫你安排行程。' }]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeLocation, setActiveLocation] = useState(null);
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
  const [currentProposals, setCurrentProposals] = useState(null); 

  const autoSaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef('');
  const autoSendTriggeredRef = useRef(false);

  // --- 核心工具函式 ---

  const fetchTravelTime = useCallback(async (originItem, destItem, mode = 'TRANSIT') => {
    if (!originItem || !destItem) return 15;
    const getPayload = (item) => {
      if (item.location?.lat && item.location?.lng) return { lat: item.location.lat, lng: item.location.lng };
      const name = item.name?.trim();
      return (!name || ['自由活動', '休息', '回飯店', '交通'].some(k => name.includes(k))) ? null : name;
    };
    const origin = getPayload(originItem);
    const dest = getPayload(destItem);
    if (!origin || !dest) return 15;
    try {
      const res = await fetch(`${API_BASE}/api/places/directions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ origin, destination: dest, mode })
      });
      const data = await res.json();
      if (data.routes?.length > 0) {
        const durationSeconds = data.routes[0].legs[0].duration.value;
        return Math.ceil(Math.ceil(durationSeconds / 60) / 15) * 15 || 15;
      }
    } catch (e) { console.warn(e.message); }
    return 15;
  }, [token]);

  const recalculateDayTimesAsync = useCallback(async (items, dayStartTime = '09:00', mode = 'TRANSIT') => {
    if (!items || items.length === 0) return items;
    let currentStartTime = normalizeTimeValue(dayStartTime);
    const newItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = { ...items[i] };
      let travelTime = (i > 0) ? await fetchTravelTime(newItems[i - 1], item, newItems[i - 1].travelMode || mode) : 0;
      const [currH, currM] = currentStartTime.split(':').map(Number);
      const arrivalDate = new Date();
      arrivalDate.setHours(currH, currM + travelTime, 0, 0);
      const startTimeStr = `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}`;
      const [startH, startM] = startTimeStr.split(':').map(Number);
      const assignedEndDate = new Date();
      assignedEndDate.setHours(startH, startM + 120, 0, 0);
      const endTimeStr = `${String(assignedEndDate.getHours()).padStart(2, '0')}:${String(assignedEndDate.getMinutes()).padStart(2, '0')}`;
      item.time = `${startTimeStr}~${endTimeStr}`;
      newItems.push(item);
      currentStartTime = endTimeStr;
    }
    return newItems;
  }, [fetchTravelTime]);

  const handleSend = async (quickText) => {
    const text = typeof quickText === 'string' ? quickText.trim() : input.trim();
    if (!text || (isSending && !quickText)) return;
    if (!token) return;
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
      if (data.proposals) {
        setCurrentProposals(data.proposals);
      } else if (data.plan) {
        const nextPlan = { ...data.plan };
        if (nextPlan.days) {
          nextPlan.days = await Promise.all(nextPlan.days.map(async (day) => ({
            ...day,
            items: await recalculateDayTimesAsync(day.items || [], day.startTime || '09:00', day.transportMode || 'TRANSIT')
          })));
        }
        setPlan(nextPlan);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || '行程已更新。' }]);
    } catch (e) { console.error(e); }
    finally { setIsSending(false); }
  };

  const generateChecklist = useCallback(async ({ silent = false, replaceExisting = false } = {}) => {
    if (!itineraryUuid || isPublicMode || !token) return { success: false };
    setIsChecklistSyncing(true);
    setIsAutoGeneratingChecklist(true);
    try {
      const res = await fetch(`${API_BASE}/api/itineraries/${itineraryUuid}/generate-checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPlan: plan, replaceExisting })
      });
      const data = await res.json();
      const nextItems = normalizeChecklistItems(data.checklistItems || []);
      setPackingItems(nextItems);
      return { success: true, checklistItems: nextItems };
    } catch (error) { return { success: false }; }
    finally {
      setIsChecklistSyncing(false);
      setIsAutoGeneratingChecklist(false);
    }
  }, [itineraryUuid, isPublicMode, token, plan]);

  const saveItinerary = useCallback(async ({ silent = false } = {}) => {
    if (!plan || !token) return false;
    const payload = {
      title: plan.tripName || plan.city || '我的行程',
      itineraryData: { ...plan, totalBudget, packingItems },
      tripNote,
      checklistItems: packingItems,
      startDate: plan.startDate,
      startTime: plan.startTime,
    };
    if (!silent) setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/itineraries${itineraryUuid ? `/${itineraryUuid}` : ''}`, {
        method: itineraryUuid ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.uuid && !itineraryUuid) setItineraryUuid(data.uuid);
      lastSavedSnapshotRef.current = JSON.stringify(payload);
      setHasUnsavedChanges(false);
      return true;
    } catch (e) { return false; }
    finally { if (!silent) setIsSaving(false); }
  }, [plan, totalBudget, packingItems, tripNote, itineraryUuid, token]);

  // --- Effects ---

  useEffect(() => {
    const prefill = location?.state?.prefill;
    if (prefill?.autoSend && prefill?.prompt && token && !autoSendTriggeredRef.current) {
      autoSendTriggeredRef.current = true;
      handleSend(prefill.prompt);
    }
  }, [token, location.state, isSending, handleSend]);

  // --- Context Value ---
  const value = {
    plan, setPlan, currentProposals, setCurrentProposals,
    messages, setMessages, input, setInput, isSending,
    activeDayIdx, setActiveDayIdx, activeTab, setActiveTab,
    packingItems, setPackingItems, totalBudget, setTotalBudget,
    itineraryUuid, showAiPanel, setShowAiPanel, sidebarCollapsed, setSidebarCollapsed,
    saveMsg, isSaving, isAutoSaving, hasUnsavedChanges, isLoadingItinerary, setIsLoadingItinerary,
    activeLocation, setActiveLocation, handleSend, saveItinerary,
    recalculateDayTimesAsync, fetchTravelTime, autoApprove, setAutoApprove,
    token, isChecklistSyncing, isAutoGeneratingChecklist, autoChecklistError,
    generateChecklist, setSaveMsg, isPublicMode
  };

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
};

export const usePlanner = () => {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used within a PlannerProvider');
  return context;
};