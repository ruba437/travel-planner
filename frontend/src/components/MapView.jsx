// frontend/src/MapView.jsx
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import {
  GoogleMap,
  Marker,
  InfoWindow,
  useJsApiLoader,
} from '@react-google-maps/api';
import { useAuth } from '../page/Authentication/AuthContext';

const API_BASE = import.meta.env.VITE_BACKEND_URL;

const dayColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];

const GOOGLE_LIBRARIES = ['places', 'geometry'];

const getDayColor = (day) => {
  if (!day) return '#6366f1';
  return dayColors[(day - 1) % dayColors.length];
};

const normalizeCoordPart = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'na';
  return num.toFixed(5);
};

const normalizeTextPart = (value) => String(value || '').trim().toLowerCase();

const toFiniteCoord = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getFiniteCoords = (value) => {
  if (!value || typeof value !== 'object') return null;
  const lat = toFiniteCoord(value.lat ?? value.location?.lat);
  const lng = toFiniteCoord(value.lng ?? value.location?.lng);
  return lat !== null && lng !== null ? { lat, lng } : null;
};

const getStartLocationText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    return String(value.name || value.label || '').trim();
  }
  return '';
};

const buildSegmentId = (day, from, to) => {
  const fromKey = from?.placeId
    ? `pid:${from.placeId}`
    : `loc:${normalizeCoordPart(from?.lat)},${normalizeCoordPart(from?.lng)}:${normalizeTextPart(from?.name)}`;
  const toKey = to?.placeId
    ? `pid:${to.placeId}`
    : `loc:${normalizeCoordPart(to?.lat)},${normalizeCoordPart(to?.lng)}:${normalizeTextPart(to?.name)}`;
  return `seg-${Number(day) || 0}-${fromKey}-${toKey}`;
};

const buildDirectionPoint = (item) => {
  if (!item) return null;

  const placeId = String(item.placeId || '').trim();
  const coords = getFiniteCoords(item);
  const lat = coords?.lat;
  const lng = coords?.lng;

  if (placeId) {
    const point = { placeId };
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      point.lat = lat;
      point.lng = lng;
    }
    return point;
  }

  if (lat !== undefined && lng !== undefined && lat !== null && lng !== null) {
    return { lat, lng };
  }

  const name = String(item.name || '').trim();
  return name || null;
};

const sameSegmentByEndpoints = (a, b) => {
  if (!a || !b) return false;
  const epsilon = 0.00001;
  return (
    Number(a.day) === Number(b.day)
    && Math.abs(Number(a.from?.lat) - Number(b.from?.lat)) <= epsilon
    && Math.abs(Number(a.from?.lng) - Number(b.from?.lng)) <= epsilon
    && Math.abs(Number(a.to?.lat) - Number(b.to?.lat)) <= epsilon
    && Math.abs(Number(a.to?.lng) - Number(b.to?.lng)) <= epsilon
  );
};

const resolveCurrentSegment = (segments, selected, selectedId) => {
  if (!segments?.length) return null;
  if (selectedId) {
    const byId = segments.find((seg) => seg.id === selectedId);
    if (byId) return byId;
  }
  if (selected) {
    const byEndpoint = segments.find((seg) => sameSegmentByEndpoints(seg, selected));
    if (byEndpoint) return byEndpoint;
  }
  return null;
};

const getMarkerIcon = (day) => {
  if (!window.google || !window.google.maps) return undefined;
  return {
    path: window.google.maps.SymbolPath.CIRCLE, 
    scale: 10, 
    fillColor: getDayColor(day), 
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  };
};

const getStartMarkerIcon = () => {
  if (!window.google || !window.google.maps) return undefined;
  return {
    path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, // 或者用一個房子的圖示
    scale: 6,
    fillColor: '#1e293b', // 深黑色代表起點
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  };
};

const containerStyle = { 
  width: '100%', 
  height: '100%', 
  borderRadius: '0 0 12px 12px' 
};

const defaultCenter = { lat: 23.7, lng: 121 };

const getPhotoUrl = (photoReference) => {
  if (!photoReference) return null;
  return `${API_BASE}/api/places/photo?ref=${encodeURIComponent(photoReference)}&maxwidth=400`;
};

const translateType = (type) => {
  switch (type) {
    case 'sight': return '景點';
    case 'food': return '美食';
    case 'shopping': return '購物';
    case 'activity': return '活動';
    case 'point_of_interest': return '地標';
    case 'establishment': return '地點';
    case 'store': return '商店';
    case 'restaurant': return '餐廳';
    case 'park': return '公園';
    default: return type;
  }
};

function MapView({
  plan,
  activeDayIdx,
  onDayChange,
  activeLocation,
  onLocationChange,
  onAddLocation,
  onSetStartLocation,
  onSetGlobalStartLocation,
  isReadOnly = false,
}) {
  const { token } = useAuth();
  const [markers, setMarkers] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [showDaySelection, setShowDaySelection] = useState(false);
  const [showStartSelection, setShowStartSelection] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const showAll = selectedDay === null;
  const [mapRef, setMapRef] = useState(null);
  const [selectedSegmentInfo, setSelectedSegmentInfo] = useState(null);
  const [loadingDirections, setLoadingDirections] = useState(false);
  const [routePath, setRoutePath] = useState(null); 
  
  const [cityCenter, setCityCenter] = useState(null);
  
  const [placeDetails, setPlaceDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const activePolylineRef = useRef(null);
  const segmentsRef = useRef([]); 
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);

  const directionsAbortRef = useRef(null);
  const directionsReqIdRef = useRef(0);
  const previousSelectedDayRef = useRef(null);
  const isMapInitiatedChangeRef = useRef(false);

  // 行程天數 → 地圖同步：activeDayIdx 變更時更新地圖 selectedDay
  useEffect(() => {
    if (isMapInitiatedChangeRef.current) {
      isMapInitiatedChangeRef.current = false;
      return;
    }
    if (activeDayIdx === undefined || activeDayIdx === null) return;
    const dayNumber = Number(plan?.days?.[activeDayIdx]?.day ?? activeDayIdx + 1);
    setSelectedDay(dayNumber);
  }, [activeDayIdx, plan?.days]);

  const [travelMode, setTravelMode] = useState('DRIVING');
  const [selectedSegment, setSelectedSegment] = useState(null);
  const planDayCount = Number(plan?.days?.length || 0);
  const safeSelectedMarkerCoords = useMemo(() => getFiniteCoords(selectedMarker), [selectedMarker]);
  const selectedPlaceId = selectedMarker?.placeId || null;
  const selectedMarkerIsPoi = Boolean(selectedMarker?.isPoi);

  const markerPlanSnapshot = useMemo(() => {
    if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) return null;

    return {
      city: String(plan.city || '').trim(),
      startLocation: getStartLocationText(plan.startLocation),
      days: plan.days.map((day, index) => ({
        day: Number(day?.day) || index + 1,
        startLocation: getStartLocationText(day?.startLocation),
        items: (Array.isArray(day?.items) ? day.items : []).map((item, index) => ({
          id: String(item?.id ?? ''),
          placeId: String(item?.placeId ?? ''),
          name: String(item?.name || '').trim(),
          type: String(item?.type || ''),
          order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
        })),
      })),
    };
  }, [plan]);

  const markerPlanSignature = useMemo(() => {
    if (!markerPlanSnapshot) return '';

    return JSON.stringify({
      city: markerPlanSnapshot.city,
      startLocation: markerPlanSnapshot.startLocation,
      days: markerPlanSnapshot.days.map((day) => ({
        day: day.day,
        startLocation: day.startLocation,
        items: day.items.map((item) => `${item.id}|${item.placeId}|${item.name}|${item.type}|${item.order}`),
      })),
    });
  }, [markerPlanSnapshot]);

  const changeMode = (mode) => {
    setRoutePath(null);
    setSelectedSegmentInfo(null);
    setTimeout(() => {
      setTravelMode(mode);
    }, 0);
  };

  const handleMapClick = (e) => {
    if (e.placeId) {
      e.stop(); 
      const poiMarker = {
        placeId: e.placeId,
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        name: '載入中...', 
        address: '讀取資訊中...',
        isPoi: true, 
      };
      setSelectedMarker(poiMarker);
      onLocationChange?.(null); 
      setSelectedSegment(null);
    } else {
      setSelectedMarker(null);
    }
  };

  useEffect(() => {
    setShowDaySelection(false); 
    setShowStartSelection(false);
  }, [selectedMarker]);

  useEffect(() => {
    if (!selectedPlaceId) {
      setPlaceDetails(null);
      return;
    }

    setLoadingDetails(true);
    setPlaceDetails(null); 

    fetch(`${API_BASE}/api/places/details?placeId=${selectedPlaceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setPlaceDetails(data);
        if (selectedMarkerIsPoi) {
          setSelectedMarker((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              name: data.name || prev.name,
              address: data.formatted_address || prev.address,
              rating: data.rating,
              userRatingsTotal: data.user_ratings_total,
              photoReference: data.photos?.[0]?.photo_reference,
              type: data.types?.[0],
            };
          });
        }
      })
      .catch((err) => console.error('Fetch Details Error', err))
      .finally(() => setLoadingDetails(false));
  }, [selectedMarkerIsPoi, selectedPlaceId, token]);

  useEffect(() => {
    const previousSelectedDay = previousSelectedDayRef.current;
    previousSelectedDayRef.current = selectedDay;

    if (previousSelectedDay === selectedDay) return;

    if (selectedMarker && Number(selectedMarker.day) === Number(selectedDay)) {
      setSelectedSegment(null);
      setSelectedSegmentId(null); 
      setSelectedSegmentInfo(null);
      setLoadingDirections(false);
      setRoutePath(null);
      return; 
    }
    if (selectedMarker?.isPoi) return;

    setSelectedMarker(null);
    setSelectedSegment(null);
    setSelectedSegmentId(null); 
    setSelectedSegmentInfo(null);
    setLoadingDirections(false);
    setRoutePath(null);
  }, [selectedDay, selectedMarker]);

  useEffect(() => {
    const maxDay = planDayCount;
    if (selectedDay !== null && (selectedDay < 1 || selectedDay > maxDay)) {
      setSelectedDay(null);
    }
    setSelectedMarker(null);
    setLoadingDirections(false);
  }, [planDayCount, selectedDay]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_LIBRARIES,
  });

  const center = useMemo(() => {
    if (cityCenter) return cityCenter;
    return defaultCenter;
  }, [cityCenter]);

  const selectedMarkerStartName = useMemo(() => {
    const rawName = String(selectedMarker?.googleName || selectedMarker?.name || '').trim();
    return rawName.replace(/^\(起點\)\s*/, '');
  }, [selectedMarker]);

  const daySegments = useMemo(() => {
    if (!markers.length) return [];
    const byDay = new Map();
    markers.forEach((m) => {
      if (!m.day) return;
      const key = Number(m.day);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(m);
    });

    const segs = [];
    byDay.forEach((marks, dayKey) => {
      const sorted = [...marks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      for (let i = 0; i < sorted.length - 1; i++) {
        const from = sorted[i];
        const to = sorted[i + 1];
        const stableId = buildSegmentId(dayKey, from, to);
        segs.push({
          id: stableId, 
          day: dayKey,
          from,
          to,
          path: [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }],
        });
      }
    });
    return segs;
  }, [markers]);

  useEffect(() => {
    if (!selectedSegment && !selectedSegmentId) return;

    const resolved = resolveCurrentSegment(daySegments, selectedSegment, selectedSegmentId);
    if (!resolved) {
      setSelectedSegment(null);
      setSelectedSegmentId(null);
      setSelectedSegmentInfo(null);
      setLoadingDirections(false);
      setRoutePath(null);
      return;
    }

    if (resolved.id !== selectedSegmentId) {
      setSelectedSegmentId(resolved.id);
      return;
    }

    if (!sameSegmentByEndpoints(resolved, selectedSegment)) {
      setSelectedSegment(resolved);
    }
  }, [daySegments, selectedSegment, selectedSegmentId]);

  useEffect(() => {
    if (!mapRef || !window.google) return;
    segmentsRef.current.forEach(line => line.setMap(null));
    segmentsRef.current = [];
    if (showAll) return; 
    if (selectedSegmentId) return; 

    daySegments.forEach(seg => {
      if (seg.day !== selectedDay) return;
      const line = new window.google.maps.Polyline({
        path: seg.path,
        strokeColor: getDayColor(seg.day),
        strokeOpacity: 0.9,
        strokeWeight: 5,
        clickable: true,
        zIndex: 1,
        map: mapRef, 
      });
      line.addListener('click', () => {
        // 1. 設定目前選中的線段
        setSelectedSegmentId(seg.id); 
        setSelectedSegment(seg);
      });
      segmentsRef.current.push(line);
    });
    return () => {
      segmentsRef.current.forEach(line => line.setMap(null));
      segmentsRef.current = [];
    };
  }, [daySegments, selectedDay, selectedSegmentId, mapRef, showAll]); 

  useEffect(() => {
    if (!mapRef || !window.google || !window.google.maps) return;

    if (markers.length > 0 && !selectedSegmentId) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.filter((m) => selectedDay === null || m.day === selectedDay)
             .forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      mapRef.fitBounds(bounds);
    } 
    else if (cityCenter && markers.length === 0) {
      mapRef.panTo(cityCenter);
      mapRef.setZoom(12);
    }
  }, [mapRef, markers, selectedDay, selectedSegmentId, cityCenter]);

  useEffect(() => {
    if (!activeLocation || !mapRef || !markers.length) return;
    if (!window.google || !window.google.maps) return;

    const target = markers.find(
      (m) => Number(m.day) === Number(activeLocation.day) && Number(m.order) === Number(activeLocation.order),
    );

    if (!target) return;

    setSelectedDay(Number(activeLocation.day));
    setSelectedMarker(target);
    setSelectedSegment(null);
    setSelectedSegmentId(null);
    setSelectedSegmentInfo(null);
    setLoadingDirections(false);
    setRoutePath(null);

    const center = new window.google.maps.LatLng(target.lat, target.lng);
    mapRef.panTo(center);
    mapRef.setZoom(15);
  }, [activeLocation, markers, mapRef]);

  useEffect(() => {
    if (!markerPlanSnapshot) return;
    if (!isLoaded) return;

    const fetchMarkers = async () => {
      try {
        setLoadingPlaces(true);
        // 1. 初始化空陣列，避免 ReferenceError
        const newMarkers = []; 
        const seenNames = new Set();
        let currentCityLocation = null;

        // 2. 抓城市中心 (優先)
        if (markerPlanSnapshot.city) {
          try {
            const cityRes = await fetch(`${API_BASE}/api/places/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ query: markerPlanSnapshot.city }),
            });
            const cityData = await cityRes.json();
            const cityPlace = cityData.places?.[0];
            const cityCoords = getFiniteCoords(cityPlace);
            if (cityCoords) {
              currentCityLocation = cityCoords;
              setCityCenter(currentCityLocation);
            }
          } catch (e) { console.error('查詢城市失敗', e); }
        }

        // 3. 抓取各天起點與行程景點
        for (const day of markerPlanSnapshot.days) {
          const dayNumber = Number(day.day);
          const effectiveStartLocation = day.startLocation || markerPlanSnapshot.startLocation;

          if (effectiveStartLocation) {
            try {
              const startRes = await fetch(`${API_BASE}/api/places/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  query: effectiveStartLocation,
                  city: markerPlanSnapshot.city,
                  center: currentCityLocation,
                }),
              });
              const startData = await startRes.json();
              const startPlace = startData.places?.[0];
              const startCoords = getFiniteCoords(startPlace);
              if (startCoords) {
                newMarkers.push({
                  sourceKey: `start:day${dayNumber}:${startPlace.placeId || effectiveStartLocation}`,
                  lat: startCoords.lat,
                  lng: startCoords.lng,
                  name: `(起點) ${effectiveStartLocation}`,
                  placeId: startPlace.placeId,
                  day: dayNumber,
                  order: -1,
                  isStart: true,
                  type: 'establishment',
                });
              }
            } catch (e) { console.error(`查詢第 ${dayNumber} 天起點失敗`, e); }
          }

          let orderInDay = 0;
          for (const item of day.items || []) {
            const itemName = item.name?.trim();
            const dedupeKey = `${dayNumber}-${itemName}`;
            if (!itemName || seenNames.has(dedupeKey)) continue;
            seenNames.add(dedupeKey);

            try {
              const res = await fetch(`${API_BASE}/api/places/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ 
                  query: itemName, 
                  city: markerPlanSnapshot.city,
                  center: currentCityLocation 
                }),
              });
              const data = await res.json();
              const place = data.places?.[0];
              const placeCoords = getFiniteCoords(place);
              if (placeCoords) {
                newMarkers.push({
                  sourceKey: `item:day${dayNumber}:order${orderInDay}:${place.placeId || itemName}`,
                  lat: placeCoords.lat,
                  lng: placeCoords.lng,
                  name: itemName || place.name,
                  googleName: place.name,
                  address: place.address || '',
                  placeId: place.placeId,
                  rating: place.rating,
                  userRatingsTotal: place.userRatingsTotal,
                  photoReference: place.photoReference || null,
                  day: dayNumber,
                  order: orderInDay,
                  type: item.type,
                  note: item.note,
                });
                orderInDay += 1;
              }
            } catch (err) { console.error(`搜尋 ${itemName} 失敗`, err); }
          }
        }
        setMarkers(newMarkers.filter((marker) => getFiniteCoords(marker)));
      } finally {
        setLoadingPlaces(false);
      }
    };
    fetchMarkers();
  }, [isLoaded, markerPlanSignature, markerPlanSnapshot, token]);

  useEffect(() => {
    if (!mapRef || !window.google) return;
    const removeLine = () => {
      if (activePolylineRef.current) {
        activePolylineRef.current.setMap(null); 
        activePolylineRef.current = null;       
      }
    };
    removeLine();
    if (routePath && routePath.length > 0) {
      const line = new window.google.maps.Polyline({
        path: routePath, strokeColor: '#2563eb', strokeOpacity: 0.95, strokeWeight: 6, zIndex: 1000, map: mapRef, 
      });
      activePolylineRef.current = line;
    }
    return () => removeLine();
  }, [routePath, mapRef]);

  const handleSegmentClick = useCallback(async (segment) => {
    const validSegment = resolveCurrentSegment(daySegments, segment, segment?.id);
    if (!validSegment) {
      setSelectedSegmentInfo({ segment, error: '路段已變更，請重新選擇路線。' });
      setSelectedSegment(null);
      setSelectedSegmentId(null);
      setRoutePath(null);
      setLoadingDirections(false);
      return;
    }

    if (validSegment.id !== selectedSegmentId) {
      setSelectedSegmentId(validSegment.id);
    }

    if (!sameSegmentByEndpoints(validSegment, selectedSegment)) {
      setSelectedSegment(validSegment);
    }

    setRoutePath(null);
    if (directionsAbortRef.current) directionsAbortRef.current.abort();
    const controller = new AbortController();
    directionsAbortRef.current = controller;
    const reqId = ++directionsReqIdRef.current;
    
    try {
      const res = await fetch(`${API_BASE}/api/places/directions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        signal: controller.signal,
        body: JSON.stringify({
          origin: buildDirectionPoint(validSegment.from),
          destination: buildDirectionPoint(validSegment.to),
          mode: travelMode,
        }),
      });
      const data = await res.json();
      if (reqId !== directionsReqIdRef.current) return;

      // 💡 1. 修正防呆保護：檢查 Google 原生欄位 data.routes
      if (!res.ok || data.error || !data.routes || data.routes.length === 0) {
        console.warn('找不到路線');
        setSelectedSegmentInfo({ 
          segment: validSegment, 
          error: data.error_message || data.error || 'Google Maps 找不到這段路的交通路線 🥲' 
        });
        setRoutePath(null);
        return;
      }

      // 取得 Google 第一條路線與路段資訊
      const route = data.routes[0];
      const leg = route.legs[0];

      // 💡 2. 畫線：正確讀取 Google 的 overview_polyline.points 並解碼成 Array
      if (route.overview_polyline && route.overview_polyline.points && window.google?.maps?.geometry?.encoding) {
        const decoded = window.google.maps.geometry.encoding.decodePath(route.overview_polyline.points);
        setRoutePath(decoded.map((p) => ({ lat: p.lat(), lng: p.lng() })));
      }

      // 💡 3. 調整地圖視野
      if (route.bounds && mapRef && window.google) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(route.bounds.northeast);
        bounds.extend(route.bounds.southwest);
        mapRef.fitBounds(bounds);
      }
      
      // 💡 4. 顯示文字資訊卡：把 leg 的資訊與 segment 合併傳進去
      setSelectedSegmentInfo({ ...leg, segment: validSegment });

    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error(err);
      setSelectedSegmentInfo({ segment: validSegment, error: '取得交通方式失敗' });
    } finally {
      if (reqId === directionsReqIdRef.current) setLoadingDirections(false);
    }
  }, [daySegments, mapRef, selectedSegment, selectedSegmentId, token, travelMode]);

  useEffect(() => {
    if (!selectedSegment) return;
    const latestSegment = resolveCurrentSegment(daySegments, selectedSegment, selectedSegmentId);
    if (!latestSegment) {
      setSelectedSegment(null);
      setSelectedSegmentId(null);
      setSelectedSegmentInfo(null);
      setLoadingDirections(false);
      setRoutePath(null);
      return;
    }

    if (latestSegment.id !== selectedSegmentId || !sameSegmentByEndpoints(latestSegment, selectedSegment)) {
      setSelectedSegment(latestSegment);
      setSelectedSegmentId(latestSegment.id);
      return;
    }

    if (directionsAbortRef.current) directionsAbortRef.current.abort();
    setRoutePath(null);
    setSelectedSegmentInfo(null);
    setLoadingDirections(true);
    const t = setTimeout(() => { handleSegmentClick(latestSegment); }, 50);
    return () => clearTimeout(t);
  }, [daySegments, handleSegmentClick, selectedSegment, selectedSegmentId, travelMode]);

  const renderRouteCard = () => {
    // 💡 我們的資訊現在不是存在 summary，而是直接在 selectedSegmentInfo 裡面 (因為它就是 leg 本身)
    const seg = selectedSegmentInfo?.segment || selectedSegment;
    const err = selectedSegmentInfo?.error;
    const distanceText = selectedSegmentInfo?.distance?.text;
    const durationText = selectedSegmentInfo?.duration?.text;
    const steps = selectedSegmentInfo?.steps || [];

    if (!seg && !loadingDirections) return null;
    return (
      <div style={{
        position: 'absolute', bottom: 8, left: 8, zIndex: 2, background: 'rgba(15,23,42,0.96)',
        color: '#f9fafb', padding: '8px 10px', borderRadius: '10px', maxWidth: '320px', fontSize: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontWeight: 'bold' }}>
            {seg ? `${seg.from?.name} → ${seg.to?.name}` : '路線資訊'}
          </div>
          <button
            onClick={() => {
              setSelectedSegment(null);
              setSelectedSegmentInfo(null);
              setLoadingDirections(false);
              setRoutePath(null); 
              setSelectedSegmentId(null); 
            }}
            style={{ border: 'none', background: 'transparent', color: '#e5e7eb', cursor: 'pointer', fontSize: '14px' }}
          >✕</button>
        </div>
        {seg && (
          <div style={{ display: 'flex', gap: 6, margin: '6px 0 8px 0' }}>
            {['DRIVING', 'TRANSIT', 'WALKING'].map(mode => (
              <button key={mode} onClick={() => changeMode(mode)}
                style={{
                  border: 'none', borderRadius: '999px', padding: '2px 8px', cursor: 'pointer',
                  background: travelMode === mode ? '#f9fafb' : 'rgba(255,255,255,0.12)',
                  color: travelMode === mode ? '#111827' : '#e5e7eb', fontSize: 11,
                }}
              >
                {mode === 'DRIVING' ? '🚗 開車' : mode === 'TRANSIT' ? '🚇 大眾運輸' : '🚶 步行'}
              </button>
            ))}
          </div>
        )}
        
        {/* 💡 這裡把 summary 判斷改成判斷 distanceText 是否存在 */}
        {loadingDirections ? <div>正在取得交通方式…</div> : err ? <div>{err}</div> : distanceText ? (
          <div style={{ maxHeight: 120, overflowY: 'auto' }}>
            <div style={{marginBottom:4}}>距離：{distanceText} · 時間：{durationText}</div>
            
            {/* 💡 這裡把轉彎指示改用 step.html_instructions */}
            {steps.map((s, i) => (
              <div
                key={`${s.instructions || s.html_instructions || 'step'}-${s.distance?.text || ''}-${s.duration?.text || ''}-${i}`}
                style={{ marginBottom: 4, paddingBottom: 4, borderBottom: '1px dashed #666' }}
              >
                <div dangerouslySetInnerHTML={{ __html: s.instructions || s.html_instructions }} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
      
      {loadingPlaces && <div style={{position:'absolute',top:8,left:8,zIndex:1,background:'white',padding:'4px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>取得位置中…</div>}
      
      {plan?.days?.length > 0 && (
        <div style={{position:'absolute',top:8,right:8,zIndex:2,display:'flex',gap:4,background:'rgba(255,255,255,0.9)',padding:6,borderRadius:99}}>
          <button onClick={() => {setSelectedDay(null);onLocationChange?.(null);}} style={{border:'none',background:selectedDay===null?'#000':'transparent',color:selectedDay===null?'#fff':'#000',borderRadius:99,padding:'2px 8px',cursor:'pointer'}}>全部</button>
          {plan.days.map((d, idx) => (
            <button key={d.day} onClick={() => {
              isMapInitiatedChangeRef.current = true;
              setSelectedDay(Number(d.day));
              onLocationChange?.(null);
              onDayChange?.(idx);
            }} 
              style={{border:'none',background:selectedDay===Number(d.day)?getDayColor(d.day):'transparent',color:selectedDay===Number(d.day)?'#fff':'#000',borderRadius:99,padding:'2px 8px',cursor:'pointer'}}>
              第 {d.day} 天
            </button>
          ))}
        </div>
      )}

      {renderRouteCard()}

      {(!plan || !plan.days || plan.days.length === 0) ? (
         <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '14px' }}>
           尚未產生行程，暫不顯示地圖。
         </div>
      ) : (
         !isLoaded ? (
           <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
             地圖載入中…
           </div>
         ) : (
           <GoogleMap
             key={showAll ? 'all' : `day-${selectedDay}`}
             mapContainerStyle={containerStyle} 
             center={center}
             zoom={12}
             onLoad={(map) => setMapRef(map)}
             onClick={handleMapClick}
             options={{ disableDefaultUI: false, clickableIcons: true, fullscreenControl: false, streetViewControl: true, mapTypeControl: false }}
           >
             {markers
              .filter((m) => selectedDay === null || m.day === selectedDay)
              .map((m) => (
                <Marker
                  key={m.sourceKey}
                  position={{ lat: Number(m.lat), lng: Number(m.lng) }}
                  onClick={() => {
                    setSelectedMarker(m);
                    if (!m.isStart) onLocationChange?.({ day: m.day, order: m.order });
                  }}
                  // 🔥 關鍵優化：區想起點與一般景點圖示
                  icon={m.isStart ? getStartMarkerIcon() : getMarkerIcon(m.day)}
                  label={{ 
                    // 起點顯示 'S'，其他顯示順序數字
                    text: m.isStart ? 'S' : String((m.order || 0) + 1), 
                    color: '#ffffff', 
                    fontSize: '12px', 
                    fontWeight: 'bold' 
                  }}
                />
              ))}

            {selectedMarker && safeSelectedMarkerCoords && (
              <InfoWindow position={safeSelectedMarkerCoords} onCloseClick={() => setSelectedMarker(null)}>
                <div style={{ maxWidth: '260px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 'bold' }}>{selectedMarker.name}</div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '11px', color: '#555' }}>
                    {selectedMarker.rating && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <span style={{ color: '#f59e0b' }}>★</span>
                        <span>{selectedMarker.rating}</span>
                        <span style={{ color: '#9ca3af' }}>({selectedMarker.userRatingsTotal})</span>
                      </span>
                    )}
                    {selectedMarker.type && (
                      <span style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: '4px' }}>
                        {translateType(selectedMarker.type)}
                      </span>
                    )}
                  </div>

                  {selectedMarker.photoReference && <img src={getPhotoUrl(selectedMarker.photoReference)} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />}
                  
                  {selectedMarker.note && (
                    <div style={{ marginBottom: '6px', padding: '4px 6px', background: '#fffbeb', borderRadius: '4px', color: '#b45309', fontSize: '11px', lineHeight: 1.3 }}>
                      💡 {selectedMarker.note}
                    </div>
                  )}

                  <div style={{color: '#6b7280', marginBottom: '4px'}}>{selectedMarker.address}</div>
                  
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedMarker.name)}`} target="_blank" rel="noreferrer" style={{color: '#2563eb', textDecoration: 'none', display: 'block', marginBottom: '8px'}}>在 Google Maps 中開啟 →</a>

                  {!isReadOnly && selectedMarkerStartName && (
                    <div style={{ marginBottom: '8px' }}>
                      {!showStartSelection ? (
                        <button
                          onClick={() => setShowStartSelection(true)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: '#0f766e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            marginBottom: selectedMarker.isPoi ? '8px' : 0,
                          }}
                        >
                          📍 設為起點
                        </button>
                      ) : (
                        <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '8px', backgroundColor: '#f9fafb', marginBottom: selectedMarker.isPoi ? '8px' : 0 }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', fontWeight: 'bold', color: '#374151' }}>將「{selectedMarkerStartName}」設為：</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <button
                              onClick={() => {
                                onSetGlobalStartLocation?.({
                                  name: selectedMarkerStartName,
                                  lat: selectedMarker.lat,
                                  lng: selectedMarker.lng,
                                  placeId: selectedMarker.placeId || null,
                                });
                                setSelectedMarker(null);
                              }}
                              style={{
                                padding: '6px 8px',
                                backgroundColor: '#fff',
                                color: '#0f766e',
                                border: '1px solid #99f6e4',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.85em',
                                fontWeight: 'bold',
                              }}
                            >
                              🌐 全域預設出發地
                            </button>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {plan?.days?.map((day, index) => (
                                <button
                                  key={`start-day-${day.day}`}
                                  onClick={() => {
                                    onSetStartLocation?.({
                                      name: selectedMarkerStartName,
                                      lat: selectedMarker.lat,
                                      lng: selectedMarker.lng,
                                      placeId: selectedMarker.placeId || null,
                                      targetDayIndex: index,
                                    });
                                    setSelectedMarker(null);
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#fff',
                                    color: '#374151',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.85em',
                                  }}
                                >
                                  第 {day.day} 天
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={() => setShowStartSelection(false)}
                            style={{
                              width: '100%',
                              marginTop: '8px',
                              padding: '4px',
                              backgroundColor: 'transparent',
                              color: '#6b7280',
                              border: 'none',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              fontSize: '0.8em',
                            }}
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 判斷是不是地圖上隨便點擊的景點 (isPoi)，如果是，就顯示加入按鈕 */}
                  {!isReadOnly && selectedMarker.isPoi && (
                    <div style={{ marginBottom: '8px' }}>
                      {/* 如果還沒點擊「加入」，顯示加入按鈕 */}
                      {!showDaySelection && (
                        <button 
                          onClick={() => setShowDaySelection(true)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          ➕ 加入行程
                        </button>
                      )}

                      {/* 點擊「加入」後，顯示具體的天數選項 */}
                      {showDaySelection && (
                        <div style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '8px', backgroundColor: '#f9fafb' }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', fontWeight: 'bold', color: '#374151' }}>請選擇要加入第幾天：</p>
                          
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {plan?.days?.map((day, index) => (
                              <button 
                                key={day.day}
                                onClick={() => {
                                  onAddLocation?.({
                                    name: selectedMarker.name,
                                    address: selectedMarker.address,
                                    type: selectedMarker.type || 'sight',
                                    placeId: selectedMarker.placeId || null,
                                    lat: selectedMarker.lat,
                                    lng: selectedMarker.lng,
                                    photoReference: selectedMarker.photoReference || null,
                                    imageUrl: getPhotoUrl(selectedMarker.photoReference) || null,
                                    targetDayIndex: index // 傳回使用者選擇的日期索引
                                  });
                                  setSelectedMarker(null); // 加完後關閉視窗
                                }}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#fff',
                                  color: '#374151',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.85em'
                                }}
                              >
                                第 {day.day} 天
                              </button>
                            ))}
                          </div>
                          
                          <button 
                            onClick={() => setShowDaySelection(false)} 
                            style={{
                              width: '100%',
                              marginTop: '8px',
                              padding: '4px',
                              backgroundColor: 'transparent',
                              color: '#6b7280',
                              border: 'none',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              fontSize: '0.8em'
                            }}
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  

                  <div style={{ borderTop: '1px solid #eee', paddingTop: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                    {loadingDetails ? (
                      <div style={{color: '#999', textAlign: 'center'}}>載入詳細資訊中...</div>
                    ) : placeDetails ? (
                      <>
                        {placeDetails.editorial_summary?.overview && (
                          <div style={{ marginBottom: '8px', lineHeight: '1.4' }}>
                            {placeDetails.editorial_summary.overview}
                          </div>
                        )}
                        
                        {placeDetails.reviews && placeDetails.reviews.length > 0 && (
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>評論 ({placeDetails.reviews.length})</div>
                            {placeDetails.reviews.slice(0, 3).map((review, i) => (
                              <div
                                key={`${review.author_name || 'review'}-${review.time || review.relative_time_description || ''}-${review.rating || ''}-${i}`}
                                style={{ marginBottom: '8px', fontSize: '11px', color: '#4b5563', borderBottom: '1px dashed #f3f4f6', paddingBottom: '4px' }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                  <strong>{review.author_name}</strong>
                                  <span style={{ color: '#f59e0b' }}>★ {review.rating}</span>
                                </div>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                  {review.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{color: '#ccc', textAlign: 'center', fontSize: '11px'}}>無更多資訊</div>
                    )}
                  </div>

                </div>
              </InfoWindow>
            )}
           </GoogleMap>
         )
      )}
    </div>
  );
}

export default MapView;