import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';

const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // 地球半徑 (公里)
    const rLat1 = Number(lat1) * Math.PI / 180;
    const rLat2 = Number(lat2) * Math.PI / 180;
    const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
    const dLon = (Number(lon2) - Number(lon1)) * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(rLat1) * Math.cos(rLat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

// 建立 Context
const PlannerContext = createContext();

// 常數定義
// eslint-disable-next-line react-refresh/only-export-components
export const API_BASE = import.meta.env.VITE_BACKEND_URL;
const DEFAULT_DAY_START_TIME = '09:00';
const CHECKLIST_LIMIT = 50;
const AUTO_SAVE_DEBOUNCE_MS = 1500;

const buildPhotoUrlFromReference = (photoReference, maxWidth = 400) => {
  if (!photoReference) return null;
  return `${API_BASE}/api/places/photo?ref=${encodeURIComponent(photoReference)}&maxwidth=${maxWidth}`;
};

const isUnstableImageUrl = (url) => {
  const text = String(url || '').trim().toLowerCase();
  return text.includes('source.unsplash.com');
};

const normalizeOptionalText = (value) => {
  const text = String(value || '').trim();
  return text || null;
};

const normalizeOptionalNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeStartLocationText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    return String(value.name || value.label || '').trim();
  }
  return '';
};

const normalizePlannerItem = (item) => {
  if (!item || typeof item !== 'object') return item;

  const directLat = normalizeOptionalNumber(item.lat);
  const directLng = normalizeOptionalNumber(item.lng);
  const nestedLat = normalizeOptionalNumber(item.location?.lat);
  const nestedLng = normalizeOptionalNumber(item.location?.lng);
  const lat = directLat ?? nestedLat;
  const lng = directLng ?? nestedLng;
  const location = Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng }
    : (item.location && typeof item.location === 'object' ? item.location : undefined);
  const rawImageUrl = String(item.imageUrl || '').trim() || null;
  const manualImageUrl = rawImageUrl && !isUnstableImageUrl(rawImageUrl) ? rawImageUrl : null;
  const refImageUrl = buildPhotoUrlFromReference(item.photoReference, 400);

  return {
    ...item,
    name: String(item.name || '').trim(),
    note: String(item.note || '').trim(),
    placeId: normalizeOptionalText(item.placeId),
    address: normalizeOptionalText(item.address),
    ...(Number.isFinite(lat) ? { lat } : {}),
    ...(Number.isFinite(lng) ? { lng } : {}),
    ...(location ? { location } : {}),
    imageUrl: refImageUrl || manualImageUrl || null,
  };
};

const normalizePlanImageUrls = (planData) => {
  if (!planData || !Array.isArray(planData.days)) return planData;

  return {
    ...planData,
    days: planData.days.map((day) => {
      const dayItems = Array.isArray(day?.items) ? day.items : [];
      return {
        ...day,
        items: dayItems.map((item) => normalizePlannerItem(item)),
      };
    }),
  };
};

const normalizePlanDayStartLocations = (planData) => {
  if (!planData) return planData;

  // 全域預設起點不做任何自動推導，保持由使用者主動設定。
  const globalStartLocation = normalizeStartLocationText(planData.startLocation);
  if (!Array.isArray(planData.days)) {
    return {
      ...planData,
      startLocation: globalStartLocation,
    };
  }

  return {
    ...planData,
    startLocation: globalStartLocation,
    days: planData.days.map((day) => {
      const dayStartLocation = normalizeStartLocationText(day?.startLocation);
      return {
        ...day,
        startLocation: dayStartLocation,
      };
    }),
  };
};

const normalizePlannerPlan = (planData) => normalizePlanImageUrls(normalizePlanDayStartLocations(planData));

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
  const [localCurrency, setLocalCurrency] = useState('TWD');
  const [currencyConfig, setCurrencyConfig] = useState({ local: 'TWD', home: 'TWD', rate: 1 });
  const [displayCurrency, setDisplayCurrency] = useState('local');
  const [currentProposals, setCurrentProposals] = useState(null); 

  const autoSaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef('');
  const autoSendTriggeredRef = useRef(false);

  const fetchExchangeRate = useCallback(async (local = 'TWD', home = 'TWD') => {
    if (local === home) {
      setCurrencyConfig({ local, home, rate: 1 });
      return;
    }

    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(local)}`);
      if (!res.ok) {
        console.warn('fetchExchangeRate failed', res.status);
        return;
      }
      const data = await res.json();
      if (data && data.rates && typeof data.rates[home] === 'number') {
        setCurrencyConfig({ local, home, rate: data.rates[home] });
      }
    } catch (error) {
      console.warn('fetchExchangeRate error', error);
    }
  }, []);

  useEffect(() => {
    fetchExchangeRate(localCurrency, currencyConfig.home);
  }, [fetchExchangeRate, localCurrency, currencyConfig.home]);

  // --- 核心邏輯 (Functions) ---

  const fetchTravelTime = useCallback(async (originItem, destItem, mode = 'TRANSIT') => {
    if (!originItem || !destItem) return 15;
    const getPayload = (item) => {
      const lat = normalizeOptionalNumber(item?.lat ?? item?.location?.lat);
      const lng = normalizeOptionalNumber(item?.lng ?? item?.location?.lng);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }

      const placeId = normalizeOptionalText(item?.placeId);
      if (placeId) {
        return { placeId };
      }

      // 若無座標，檢查名稱是否有效
      const name = String(item?.name || '').trim();
      if (!name || ['自由活動', '休息', '回飯店', '交通', '捷運', '搭乘'].some(k => name.includes(k))) {
        return null;
      }
      return name;
    };
    const origin = getPayload(originItem);
    const dest = getPayload(destItem);
    if (!origin || !dest) return 15;

    // 額外座標檢查
    if (typeof origin === 'object' && !origin.placeId && (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng))) return 15;
    if (typeof dest === 'object' && !dest.placeId && (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng))) return 15;

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

  // ====== 輔助函數：通用座標提取器 ======
  const getCoords = (location) => {
    if (!location) return null;
    
    // 情況1：純物件 { lat: number, lng: number }
    if (typeof location === 'object') {
      const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
      const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
      
      if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
        return {
          lat: Number(lat),
          lng: Number(lng)
        };
      }

      // 情況2：嵌套物件 location.location 或 location.geometry.location
      const nested = location.location || location.geometry?.location;
      if (nested) {
        const nestedLat = typeof nested.lat === 'function' ? nested.lat() : nested.lat;
        const nestedLng = typeof nested.lng === 'function' ? nested.lng() : nested.lng;
        
        if (Number.isFinite(Number(nestedLat)) && Number.isFinite(Number(nestedLng))) {
          return {
            lat: Number(nestedLat),
            lng: Number(nestedLng)
          };
        }
      }
    }
    
    return null;
  };

  // ====== 輔助函數：呼叫 Google 幫忙把「地名」轉成「經緯度座標」 ======
  const fetchCoordinatesFromName = async (placeName) => {
    // 如果輸入已經是座標物件，直接用 getCoords 提取
    if (typeof placeName === 'object') {
      const coords = getCoords(placeName);
      if (coords) return coords;
      
      // 嘗試從物件的 name 或 label 欄位取地名
      placeName = placeName.name || placeName.label || String(placeName);
    }

    // 確保 placeName 是字符串
    const nameStr = String(placeName || '').trim();
    if (!nameStr) return null;

    const coordsFromGoogleSdk = await new Promise((resolve) => {
      if (!window.google || !window.google.maps) {
        return resolve(null);
      }
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: nameStr }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          return resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          });
        }
        resolve(null);
      });
    });

    if (coordsFromGoogleSdk) return coordsFromGoogleSdk;

    // 前端 Google SDK 不可用或查無結果時，退回後端 Places Text Search
    try {
      const res = await fetch(`${API_BASE}/api/places/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: nameStr,
          city: plan?.city || undefined,
        }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      const firstPlace = Array.isArray(data?.places) ? data.places[0] : null;
      const fallbackCoords = getCoords(firstPlace) || (firstPlace && Number.isFinite(Number(firstPlace.lat)) && Number.isFinite(Number(firstPlace.lng))
        ? { lat: Number(firstPlace.lat), lng: Number(firstPlace.lng) }
        : null);

      return fallbackCoords;
    } catch (error) {
      console.warn('fetchCoordinatesFromName fallback failed:', error);
      return null;
    }
  };

  // ====== 自動順路排序當天行程 ======
  const optimizeDayRoute = async (dayIndex) => {
    if (!plan || !plan.days || !plan.days[dayIndex]) return;
    
    // 1. 深度拷貝
    let dayItems = [...plan.days[dayIndex].items];
    
    if (dayItems.length <= 1) {
      alert('景點數量太少，不需要排序喔！');
      return;
    }

    // 2. 補齊缺失的座標
    dayItems = await Promise.all(dayItems.map(async (item) => {
      if (item.lat && item.lng) return item; // 已經有座標就跳過
      if (item.location?.lat && item.location?.lng) {
        return { ...item, lat: item.location.lat, lng: item.location.lng };
      }
      
      // 呼叫 Google 查座標
      const coords = await fetchCoordinatesFromName(item.name);
      
      if (coords) {
        return { ...item, lat: coords.lat, lng: coords.lng }; // 把查到的座標補進去
      }
      return item; // 真的查不到就維持原樣
    }));

    // 3. 過濾出有座標的景點與無座標的景點
    const validItems = dayItems.filter(item => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)));
    const invalidItems = dayItems.filter(item => !Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng)));

    if (validItems.length === 0) {
      alert('無法取得這些地點的 Google 座標，無法自動排序！');
      return;
    }

    // ========== 最近鄰居演算法 (Nearest Neighbor Algorithm) ==========
    // 4. 取得有效起點 (Effective Start Location)
    const effectiveStart = plan.days[dayIndex].startLocation || plan.startLocation;
    
    let currentLocation = null;

    // 強制嘗試從 effectiveStart 提取座標
    if (effectiveStart) {
      // 先試著直接提取（如果 effectiveStart 已經是座標物件）
      const directCoords = getCoords(effectiveStart);
      if (directCoords) {
        currentLocation = directCoords;
      } else {
        // 否則視為地名，查詢其座標
        const queryCoords = await fetchCoordinatesFromName(effectiveStart);
        if (queryCoords) {
          currentLocation = queryCoords;
        } else {
          console.warn(`❌ 無法從 Google Geocoding 取得起點座標，改用第一個景點`);
        }
      }
    }

    // Fallback：如果起點座標提取失敗，使用第一個景點
    if (!currentLocation) {
      currentLocation = getCoords(validItems[0]) || { lat: validItems[0].lat, lng: validItems[0].lng };
      console.warn(`⚠️ Fallback 到第一個景點作為起點`);
    }

    // 5. 初始化未訪問景點陣列
    const unvisited = [...validItems];
    const optimizedItems = [];

    // 6. 貪心迴圈：每次找到最近的未訪問景點，直到所有景點都被訪問
    while (unvisited.length > 0) {
      // 在所有未訪問景點中，找到距離 currentLocation 最近的那個
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      let nearestItem = null;

      for (let i = 0; i < unvisited.length; i++) {
        const itemCoords = getCoords(unvisited[i]) || { lat: unvisited[i].lat, lng: unvisited[i].lng };
        const dist = getDistance(
          currentLocation.lat,
          currentLocation.lng,
          itemCoords.lat,
          itemCoords.lng
        );
        
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestIndex = i;
          nearestItem = unvisited[i];
        }
      }

      if (!nearestItem) {
        console.error(`❌ 排序迭代未找到最近景點`);
        break;
      }

      // 將最近的景點從 unvisited 移出，加入 optimizedItems
      unvisited.splice(nearestIndex, 1);
      optimizedItems.push(nearestItem);

      // 更新當前位置為這個景點的座標，進入下一輪
      currentLocation = getCoords(nearestItem) || { lat: nearestItem.lat, lng: nearestItem.lng };
    }

    // 7. 防呆機制：確保 optimizedItems 只包含景點，不含起點標記
    // （起點應該永遠單獨存在於 day.startLocation，不應混入 items 陣列）
    const finalItems = [...optimizedItems, ...invalidItems];

    // 8. 更新 React State
    const newPlan = {
      ...plan,
      days: plan.days.map((day, idx) => 
        idx === dayIndex ? { ...day, items: finalItems } : day
      )
    };
    
    setPlan(newPlan);

    // 9. 重新計算交通時間
    const updatedItems = await recalculateDayTimesAsync(
      finalItems, 
      newPlan.days[dayIndex].startTime, 
      newPlan.days[dayIndex].transportMode || 'TRANSIT'
    );
    
    setPlan({
      ...newPlan,
      days: newPlan.days.map((day, idx) => 
        idx === dayIndex ? { ...day, items: updatedItems } : day
      )
    });

  };

  // 3. AI 發送訊息與行程同步
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
      if (!res.ok || data.error) throw new Error(data.error || 'AI 請求失敗');

      if (data.plan) {
        const nextPlan = normalizePlannerPlan({ ...data.plan });
        if (nextPlan.days && Array.isArray(nextPlan.days)) {
          // 對 AI 回傳的每一天進行過濾、查座標、排序與時間重算
          nextPlan.days = await Promise.all(
            nextPlan.days.map(async (day) => {
              let validItems = (day.items || []).filter((item) => item && String(item.name || '').trim());
              const dayStartTime = day.startTime || '09:00';
              const mode = day.transportMode || 'TRANSIT';

              // ==========================================
              // 攔截 AI 的行程，自動查座標並順路排序
              // ==========================================
              if (validItems.length > 2) {
                // 1. 補齊 AI 景點的座標
                validItems = await Promise.all(validItems.map(async (item) => {
                  if (Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))) return normalizePlannerItem(item);
                  if (item.location?.lat && item.location?.lng) {
                    return normalizePlannerItem({ ...item, lat: item.location.lat, lng: item.location.lng });
                  }
                  // 呼叫 Google 查座標
                  const coords = await fetchCoordinatesFromName(item.name);
                  if (coords) return normalizePlannerItem({ ...item, lat: coords.lat, lng: coords.lng });
                  return normalizePlannerItem(item);
                }));

                // 2. 分離有座標與無座標景點
                const withCoords = validItems.filter(item => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)));
                const withoutCoords = validItems.filter(item => !Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng)));

                // 3. 執行最短距離排序 (若有起點，先以起點做第一個參考點)
                if (withCoords.length > 1) {
                  const effectiveStart = day.startLocation || nextPlan.startLocation;
                  let currentLocation = null;

                  if (effectiveStart) {
                    const directCoords = getCoords(effectiveStart);
                    currentLocation = directCoords || await fetchCoordinatesFromName(effectiveStart);
                  }

                  // 無可用起點時才退回第一個景點
                  if (!currentLocation) {
                    currentLocation = getCoords(withCoords[0]) || { lat: withCoords[0].lat, lng: withCoords[0].lng };
                  }

                  const unvisited = [...withCoords];
                  const optimized = [];

                  while (unvisited.length > 0) {
                    let nearestIndex = 0;
                    let nearestDistance = Infinity;

                    for (let i = 0; i < unvisited.length; i++) {
                      const itemCoords = getCoords(unvisited[i]) || { lat: unvisited[i].lat, lng: unvisited[i].lng };
                      const dist = getDistance(
                        currentLocation.lat,
                        currentLocation.lng,
                        itemCoords.lat,
                        itemCoords.lng
                      );
                      if (dist < nearestDistance) {
                        nearestDistance = dist;
                        nearestIndex = i;
                      }
                    }

                    const nearestItem = unvisited.splice(nearestIndex, 1)[0];
                    optimized.push(nearestItem);
                    currentLocation = getCoords(nearestItem) || { lat: nearestItem.lat, lng: nearestItem.lng };
                  }

                  // 排完後再把無座標的接回最後面
                  validItems = [...optimized, ...withoutCoords];
                }
              }
              // ==========================================

              // 拿著排序好的景點，去呼叫 Google 算精準交通時間！
              const recalculatedItems = await recalculateDayTimesAsync(validItems, dayStartTime, mode);
              return { ...day, items: recalculatedItems };
            })
          );
        }
        setPlan(normalizePlannerPlan(nextPlan));
        if (nextPlan.currency) {
          setLocalCurrency(nextPlan.currency);
        }
        setCurrentProposals(null);
      } else if (Array.isArray(data.proposals) && data.proposals.length > 0) {
        setCurrentProposals(data.proposals);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || '行程已更新。' }]);
    } catch (e) { console.error(e); }
    finally { setIsSending(false); }
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
          startLocation: itineraryData.startLocation || '',
          note: publicData.note || '',
          days: Array.isArray(itineraryData.days) ? itineraryData.days : [],
          totalBudget: itineraryData.totalBudget || 50000,
          tags: itineraryData.tags || [],
          // 公開行程來源資訊
          sourceAuthor: publicData.author,
          downloadsCount: publicData.downloadsCount,
          publishedAt: publicData.publishedAt,
        };

        setPlan(normalizePlannerPlan(loadedPlan));
        setItineraryUuid(publicData.uuid);
        if (loadedPlan.currency) {
          setLocalCurrency(loadedPlan.currency);
        }
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

        setPlan(normalizePlannerPlan({
          ...itineraryData,
          tripName: data.title || itineraryData.tripName || data.city || '我的行程',
          summary: data.summary || itineraryData.summary || '',
          city: data.city || itineraryData.city || '',
          startDate: data.startDate || itineraryData.startDate || '',
          startTime: data.startTime || itineraryData.startTime || '09:00',
          days,
          totalBudget: itineraryData.totalBudget || 50000,
        }));
        setPackingItems(normalizeChecklistItems(loadedPackingItems));
        setTotalBudget(itineraryData.totalBudget || 50000);
        setTripNote(data.tripNote || itineraryData.tripNote || '');
        setItineraryUuid(data.uuid || itineraryUuidParam);
        setLocalCurrency(itineraryData.currency || 'TWD');
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
    const normalizedPlan = normalizePlannerPlan(plan);
    return {
      title: normalizedPlan.tripName || normalizedPlan.city || '我的行程',
      itineraryData: { ...normalizedPlan, totalBudget, packingItems: nextPackingItems },
      tripNote,
      checklistItems: nextPackingItems,
      startDate: normalizedPlan.startDate,
      startTime: normalizedPlan.startTime,
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
        ...normalizePlannerPlan(persistencePayload?.itineraryData || plan),
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

  // 更新單一景點的預算成本
  const updateItemCost = useCallback((dayIndex, itemIndex, newCost) => {
    if (!plan || !plan.days || !plan.days[dayIndex] || !plan.days[dayIndex].items) return;
    
    const updatedPlan = {
      ...plan,
      days: plan.days.map((day, dIdx) => {
        if (dIdx !== dayIndex) return day;
        return {
          ...day,
          items: day.items.map((item, iIdx) => {
            if (iIdx !== itemIndex) return item;
            return { ...item, cost: Number(newCost) || 0 };
          })
        };
      })
    };
    
    setPlan(updatedPlan);
  }, [plan]);

  const updateGlobalStartLocation = useCallback((newLocation) => {
    if (!plan) return;
    setPlan({
      ...plan,
      startLocation: normalizeStartLocationText(newLocation),
    });
  }, [plan]);

  const updateDayStartLocation = useCallback((dayIndex, newLocation) => {
    if (!plan || !Array.isArray(plan.days) || !plan.days[dayIndex]) return;
    setPlan({
      ...plan,
      days: plan.days.map((day, index) => (
        index === dayIndex
          ? { ...day, startLocation: normalizeStartLocationText(newLocation) }
          : day
      )),
    });
  }, [plan]);

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
    setIsLoadingItinerary,
    activeLocation, setActiveLocation,
    // weatherData,
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
    optimizeDayRoute,
    updateItemCost,
    updateGlobalStartLocation,
    updateDayStartLocation,
    localCurrency,
    setLocalCurrency,
    currencyConfig,
    displayCurrency,
    setDisplayCurrency,
    currentProposals,
    setCurrentProposals,
  };

  // ── 🚀 核心：自動發送偵測器 ──
  // 當 token 備妥且首頁有 prefill 請求時，自動執行 handleSend
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  useEffect(() => {
    const prefill = location?.state?.prefill;
    if (prefill?.autoSend && prefill?.prompt && token && !autoSendTriggeredRef.current) {
      autoSendTriggeredRef.current = true;

      // 這裡直接呼叫，不再等 setTimeout，或者縮短時間
      handleSendRef.current(prefill.prompt);
    }
  }, [token, location.state, isSending, handleSend]);

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePlanner = () => {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used within a PlannerProvider');
  return context;
};