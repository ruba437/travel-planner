// frontend/src/MapView.jsx
import { useEffect, useMemo, useState } from 'react';
import {
  GoogleMap,
  Marker,
  InfoWindow,
  Polyline,
  useJsApiLoader,
} from '@react-google-maps/api';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';


const dayColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];

const getDayColor = (day) => {
  if (!day) return '#6366f1';
  return dayColors[(day - 1) % dayColors.length];
};

const getMarkerIcon = (day) => {
  if (!window.google || !window.google.maps) return undefined;

  return {
    path: window.google.maps.SymbolPath.CIRCLE, 
    scale: 10, 
    fillColor: getDayColor(day), // 依照 day 給顏色
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  };
};


// 地圖容器樣式
const containerStyle = {
  width: '100%',
  height: '620px',
  borderRadius: '8px',
};

// 預設中心（台灣中間附近）
const defaultCenter = { lat: 23.7, lng: 121 };

// 一些常見城市的大致中心點
const cityCenters = {
  台中: { lat: 24.1477, lng: 120.6736 },
  台北: { lat: 25.033, lng: 121.5654 },
  高雄: { lat: 22.6273, lng: 120.3014 },
};

// 後端 proxy 過的照片網址
const getPhotoUrl = (photoReference) => {
  if (!photoReference) return null;
  return `${API_BASE}/api/places/photo?ref=${encodeURIComponent(
    photoReference,
  )}&maxwidth=400`;
};

function MapView({ plan, activeLocation, onLocationChange }) {
  const [markers, setMarkers] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const showAll = selectedDay === null;
  const [mapRef, setMapRef] = useState(null);
  const [selectedSegmentInfo, setSelectedSegmentInfo] = useState(null);
  const [loadingDirections, setLoadingDirections] = useState(false);

  // 交通模式：DRIVING / TRANSIT / WALKING
  const [travelMode, setTravelMode] = useState('DRIVING');
  const [selectedSegment, setSelectedSegment] = useState(null);


  // 切換天數時，把 InfoWindow 關掉
  useEffect(() => {
    setSelectedMarker(null);
    setSelectedSegment(null);
    setSelectedSegmentInfo(null);
    setLoadingDirections(false);
  }, [selectedDay]);

  // 重新產生新行程後
  useEffect(() => {
    setSelectedDay(null);
    setSelectedMarker(null);
    setSelectedSegment(null);
    setSelectedSegmentInfo(null);
    setLoadingDirections(false);
  }, [plan]);


  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // 根據城市決定中心點
  const center = useMemo(() => {
    if (!plan || !plan.city) return defaultCenter;
    return (
      cityCenters[plan.city] ||
      cityCenters[plan.city.replace('市', '')] ||
      defaultCenter
    );
  }, [plan]);

  
  

  // 把每一天拆成多段 segment
  // day 1 有 3 個點，就會變成 2 個 segments
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
      const sorted = [...marks].sort((a, b) => (a.order || 0) - (b.order || 0));
      for (let i = 0; i < sorted.length - 1; i++) {
        const from = sorted[i];
        const to = sorted[i + 1];
        segs.push({
          id: `${dayKey}-${from.placeId || i}-${to.placeId || i + 1}`,
          day: dayKey,
          from,
          to,
          path: [
            { lat: from.lat, lng: from.lng },
            { lat: to.lat, lng: to.lng },
          ],
        });
      }
    });

    return segs;
  }, [markers]);

  useEffect(() => {
  if (!activeLocation || !mapRef || !markers.length) return;
  if (!window.google || !window.google.maps) return;

  const target = markers.find(
    (m) =>
      Number(m.day) === Number(activeLocation.day) &&
      Number(m.order) === Number(activeLocation.order),
  );

  if (!target) return;

  // 在地圖上開啟這個點的 InfoWindow
  setSelectedMarker(target);

  // 平移 + 放大到這個點
  const center = new window.google.maps.LatLng(target.lat, target.lng);
  mapRef.panTo(center);
  mapRef.setZoom(15);
}, [activeLocation, markers, mapRef]);


  useEffect(() => {
  // 沒有 map 或是沒有 marker 就不用動
  if (!mapRef || !markers.length) return;
  if (!window.google || !window.google.maps) return;

  // 依照目前選到的天數決定哪些 marker 要顯示在畫面上
  const visibleMarkers = markers.filter(
    (m) => selectedDay === null || m.day === selectedDay,
  );

  if (!visibleMarkers.length) return;

  const bounds = new window.google.maps.LatLngBounds();

  visibleMarkers.forEach((m) => {
    bounds.extend({ lat: m.lat, lng: m.lng });
  });

  // 自動縮放到這些點
  mapRef.fitBounds(bounds);
  }, [mapRef, markers, selectedDay]);



  // 當 plan 改變時，去後端查每個景點的真實座標
  useEffect(() => {
    if (!plan || !plan.days || plan.days.length === 0) {
      setMarkers([]);
      return;
    }
    if (!isLoaded) return;

    const fetchMarkers = async () => {
      try {
        setLoadingPlaces(true);
        const newMarkers = [];
        const seenNames = new Set();

        for (const day of plan.days) {
          const dayNumber = Number(day.day); // 確保是 number
          let orderInDay = 0;

          for (const item of day.items || []) {
            const itemName = item.name?.trim();
            const dedupeKey = `${dayNumber}-${itemName}`;
            if (!itemName || seenNames.has(dedupeKey)) continue;
            seenNames.add(dedupeKey);

            try {
              const res = await fetch(
                `${API_BASE}/api/places/search`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    query: itemName,
                    city: plan.city,
                  }),
                },
              );

              const data = await res.json();
              const place = data.places && data.places[0];

              if (place && place.lat && place.lng) {
                newMarkers.push({
                  lat: place.lat,
                  lng: place.lng,
                  name: itemName || place.name,
                  googleName: place.name,
                  address:
                    place.address && place.address !== place.name
                      ? place.address
                      : '',
                  placeId: place.placeId,
                  rating: place.rating,
                  userRatingsTotal: place.userRatingsTotal,
                  photoReference: place.photoReference || null,

                  day: dayNumber,   
                  order: orderInDay, // 當天順序
                });

                orderInDay += 1;
              }
            } catch (err) {
              console.error('Error fetching place for', itemName, err);
            }
          }
        }

        setMarkers(newMarkers);
      } finally {
        setLoadingPlaces(false);
      }
    };

    fetchMarkers();
  }, [plan, isLoaded]);

  useEffect(() => {
    // 只有在「已經點過某段線」時，切換模式才自動重查
    if (!selectedSegment) return;
    handleSegmentClick(selectedSegment);
  }, [travelMode]);


  // -------- loading / 無行程 顯示 --------
  if (!plan || !plan.days || plan.days.length === 0) {
    return (
      <div
        style={{
          fontSize: '12px',
          color: '#9ca3af',
          border: '1px dashed #e5e7eb',
          borderRadius: '8px',
          padding: '8px',
        }}
      >
        尚未產生行程，暫不顯示地圖。
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        style={{
          fontSize: '12px',
          color: '#9ca3af',
          border: '1px dashed #e5e7eb',
          borderRadius: '8px',
          padding: '8px',
        }}
      >
        地圖載入中…
      </div>
    );
  }

  const renderRouteCard = () => {
    
    if (!selectedSegmentInfo && !loadingDirections) return null;

    
    const seg = selectedSegmentInfo?.segment || selectedSegment;
    const summary = selectedSegmentInfo?.summary;
    const err = selectedSegmentInfo?.error;

    
    if (!seg && !loadingDirections) return null;

    return (
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          zIndex: 2,
          background: 'rgba(15,23,42,0.96)',
          color: '#f9fafb',
          padding: '8px 10px',
          borderRadius: '10px',
          maxWidth: '320px',
          fontSize: '12px',
          boxShadow: '0 10px 25px rgba(15,23,42,0.3)',
        }}
      >
        {/* 標題列：起點 → 終點 + 關閉 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontWeight: 'bold' }}>
            {seg ? `${seg.from?.name || ''} → ${seg.to?.name || ''}` : '路線資訊'}
          </div>

          <button
            onClick={() => {
              setSelectedSegment(null);
              setSelectedSegmentInfo(null);
              setLoadingDirections(false);
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#e5e7eb',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
            }}
            title="關閉"
          >
            ✕
          </button>
        </div>

        {/* 交通方式按鈕：只有點到路線後顯示 */}
        {seg && (
          <div style={{ display: 'flex', gap: 6, margin: '6px 0 8px 0' }}>
            <button
              onClick={() => setTravelMode('DRIVING')}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '2px 8px',
                cursor: 'pointer',
                background:
                  travelMode === 'DRIVING' ? '#f9fafb' : 'rgba(255,255,255,0.12)',
                color: travelMode === 'DRIVING' ? '#111827' : '#e5e7eb',
                fontSize: 11,
              }}
            >
              🚗 開車
            </button>

            <button
              onClick={() => setTravelMode('TRANSIT')}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '2px 8px',
                cursor: 'pointer',
                background:
                  travelMode === 'TRANSIT' ? '#f9fafb' : 'rgba(255,255,255,0.12)',
                color: travelMode === 'TRANSIT' ? '#111827' : '#e5e7eb',
                fontSize: 11,
              }}
            >
              🚇 大眾運輸
            </button>

            <button
              onClick={() => setTravelMode('WALKING')}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '2px 8px',
                cursor: 'pointer',
                background:
                  travelMode === 'WALKING' ? '#f9fafb' : 'rgba(255,255,255,0.12)',
                color: travelMode === 'WALKING' ? '#111827' : '#e5e7eb',
                fontSize: 11,
              }}
            >
              🚶 步行
            </button>
          </div>
        )}

        {/* 內容區：loading / error / summary */}
        {loadingDirections ? (
          <div>正在取得交通方式…</div>
        ) : err ? (
          <div>{err}</div>
        ) : summary ? (
          <>
            <div style={{ marginBottom: 4 }}>
              預估距離：{summary.distanceText} · 預估時間：{summary.durationText}
            </div>

            <div style={{ maxHeight: 120, overflowY: 'auto' }}>
              {(summary.steps || []).map((s, i) => (
                <div
                  key={`${seg?.id || 'seg'}-${travelMode}-${i}`}
                  style={{
                    marginBottom: 4,
                    paddingBottom: 4,
                    borderBottom: '1px dashed rgba(148,163,184,0.4)',
                  }}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: s.instructionHtml,
                    }}
                  />
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {s.distanceText} · {s.durationText} · {s.travelMode}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    );
  };

  async function handleSegmentClick(segment) {
    setSelectedSegment(segment);
    setSelectedSegmentInfo(null);
    setLoadingDirections(true);
    try {
      const res = await fetch(`${API_BASE}/api/directions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: segment.from.lat, lng: segment.from.lng },
          destination: { lat: segment.to.lat, lng: segment.to.lng },
          mode: travelMode,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSelectedSegmentInfo({ segment, error: data.error_message || data.error });
      } else {
        setSelectedSegmentInfo({ segment, summary: data.summary });
      }
    } catch (err) {
      console.error(err);
      setSelectedSegmentInfo({ segment, error: '取得交通方式失敗，請稍後再試。' });
    } finally {
      setLoadingDirections(false);
    }
}


  // -------- 地圖 --------
  return (
    <div style={{ position: 'relative' }}>
      {loadingPlaces && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 1,
            background: 'rgba(255,255,255,0.9)',
            padding: '4px 8px',
            borderRadius: '8px',
            fontSize: '11px',
            color: '#4b5563',
          }}
        >
          取得景點位置中…
        </div>
      )}
      
      

      {/* 天數切換按鈕 */}
      {plan?.days && plan.days.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
            display: 'flex',
            gap: 4,
            background: 'rgba(255,255,255,0.95)',
            padding: '4px 6px',
            borderRadius: '999px',
            boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
            fontSize: '11px',
          }}
        >
          <button
            onClick={() => {
              setSelectedDay(null);
              onLocationChange?.(null); // 清掉目前選的
            }}
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '2px 8px',
              cursor: 'pointer',
              background: selectedDay === null ? '#111827' : 'transparent',
              color: selectedDay === null ? '#f9fafb' : '#4b5563',
            }}
          >
            全部
          </button>
          {plan.days.map((d) => {
            const dayNumber = Number(d.day);
            const active = selectedDay === dayNumber;
            return (
              <button
                key={d.day}
                onClick={() => {
                  setSelectedDay(dayNumber);
                  onLocationChange?.(null);
                }}
                style={{
                  border: 'none',
                  borderRadius: '999px',
                  padding: '2px 8px',
                  cursor: 'pointer',
                  background: active ? getDayColor(dayNumber) : 'transparent',
                  color: active ? '#f9fafb' : '#4b5563',
                }}
              >
                第 {d.day} 天
              </button>
            );
          })}
        </div>
      )}

      {renderRouteCard()}



      <GoogleMap
        key={showAll ? 'all' : `day-${selectedDay}`}
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={(map) => setMapRef(map)}
        options={{
          disableDefaultUI: false,
          clickableIcons: false,
          fullscreenControl: false,
          streetViewControl: true,
          mapTypeControl: false,
        }}
      >
      
        {/*  只有選某一天時才畫出「該天的每一段 segment」 */}
        {!showAll &&
          daySegments
            .filter((seg) => seg.day === selectedDay)
            .map((seg) => (
              <Polyline
                key={seg.id}
                path={seg.path}
                options={{
                  strokeColor: getDayColor(seg.day),
                  strokeOpacity: 0.9,
                  strokeWeight: 5,
                  clickable: true,
                }}
                onClick={() => handleSegmentClick(seg)}
              />
            ))}



        {/*  Marker：全部模式顯示所有天；選某一天只顯示該天 */}
        {markers
          .filter((m) => selectedDay === null || m.day === selectedDay)
          .map((m, idx) => {
            // 每一天內的編號（1, 2, 3...）
            const labelText = String((m.order ?? 0) + 1);

            

            return (
              <Marker
                key={`${m.day}-${m.order}-${m.placeId || idx}`}
                position={{ lat: m.lat, lng: m.lng }}
                title={m.name}
                onClick={() => {
                  setSelectedMarker(m);
                  setSelectedSegment(null);
                  setSelectedSegmentInfo(null);
                  setLoadingDirections(false);
                  onLocationChange?.({ day: m.day, order: m.order });
                }}
                // 🟢 每一天不同顏色的小圓點
                icon={getMarkerIcon(m.day)}
                // 圓點中間的編號（同一天內 1,2,3...）
                label={{
                  text: String((m.order || 0) + 1), // m.order 算好的順序
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              />
            );
          })}





        {/* InfoWindow：帶圖片 + 名稱 + 地址 + 連到 Google Maps */}
        {selectedMarker && (
          <InfoWindow
            position={{
              lat: selectedMarker.lat,
              lng: selectedMarker.lng,
            }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div style={{ maxWidth: '240px', fontSize: '12px' }}>
              <div
                style={{
                  fontWeight: 'bold',
                  marginBottom: '4px',
                }}
              >
                {selectedMarker.name}
              </div>

              {selectedMarker.photoReference && (
                <img
                  src={getPhotoUrl(selectedMarker.photoReference)}
                  alt={selectedMarker.name}
                  style={{
                    width: '100%',
                    height: '140px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    marginBottom: '6px',
                  }}
                />
              )}

              {selectedMarker.address && (
                <div
                  style={{
                    marginBottom: '6px',
                    color: '#4b5563',
                    lineHeight: 1.4,
                  }}
                >
                  {selectedMarker.address}
                </div>
              )}

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  selectedMarker.name +
                    ' ' +
                    (selectedMarker.address || ''),
                )}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'none' }}
              >
                在 Google Maps 中開啟 →
              </a>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );

  



}

  


export default MapView;
