// frontend/src/MapView.jsx
import { useEffect, useMemo, useState } from 'react';
import {
  GoogleMap,
  Marker,
  InfoWindow,
  Polyline,
  useJsApiLoader,
} from '@react-google-maps/api';

const dayColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];

const getDayColor = (day) => {
  if (!day) return '#6366f1';
  // day 從 1 開始，所以要 -1
  return dayColors[(day - 1) % dayColors.length];
};

const getMarkerIcon = (day) => {
  // 還沒載入 Google Maps SDK 的時候先回傳 undefined
  if (!window.google || !window.google.maps) return undefined;

  return {
    path: window.google.maps.SymbolPath.CIRCLE, // 用圓形符號
    scale: 10, // 圓點大小
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
  return `http://localhost:3000/api/places/photo?ref=${encodeURIComponent(
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

  // 切換天數時，把 InfoWindow 關掉
  useEffect(() => {
    setSelectedMarker(null);
  }, [selectedDay]);

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

  // 🔹 根據 markers 算出「每一天」的路線
  // 根據 markers 算出「每一天」的路線 path
  const dayPaths = useMemo(() => {
    if (!markers.length) return {};

    // 依照 day 分組
    const byDay = new Map();

    markers.forEach((m) => {
      if (!m.day) return;
      const key = Number(m.day);  
      if (!byDay.has(key)) {
        byDay.set(key, []);
      }
      byDay.get(key).push(m);
    });

    const result = {};

    byDay.forEach((marks, dayKey) => {
      // 依照當天的 order 排序
      const sorted = [...marks].sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );
      // 轉成 Google Map 要的 path 格式
      result[dayKey] = sorted.map((m) => ({
        lat: m.lat,
        lng: m.lng,
      }));
    });

    return result; // 例如：{ "1": [...], "2": [...], "3": [...] }
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



  // 🔹 當 plan 改變時，去後端查每個景點的真實座標
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
                'http://localhost:3000/api/places/search',
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

                  day: dayNumber,   // ✅ number
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

  // -------- 真的地圖 --------
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

      {/* 🔸 天數切換按鈕 */}
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
      
        {/* ✅ 只有「選某一天」時才畫線，選全部不畫任何路線 */}
        {!showAll && dayPaths[String(selectedDay)] && (
          <Polyline
            key={selectedDay} // 保留沒關係
            path={dayPaths[String(selectedDay)]}
            options={{
              strokeColor: getDayColor(selectedDay),
              strokeOpacity: 0.9,
              strokeWeight: 4,
            }}
          />
        )}



        {/* 🔸 Marker：全部模式顯示所有天；選某一天只顯示該天 */}
        {markers
          .filter((m) => selectedDay === null || m.day === selectedDay)
          .map((m, idx) => {
            // 每一天內的編號（1, 2, 3...）
            const labelText = String((m.order ?? 0) + 1);

            // 安全取得圓形圖示（如果 google 還沒載好就用預設 icon）
            let icon = undefined;
            if (window.google && window.google.maps && window.google.maps.SymbolPath) {
              icon = {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10, // 圓點大小
                fillColor: getDayColor(m.day),
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              };
            }

            return (
              <Marker
                key={m.placeId || idx}
                position={{ lat: m.lat, lng: m.lng }}
                title={m.name}
                onClick={() => {
                  setSelectedMarker(m);
                  onLocationChange?.({ day: m.day, order: m.order });
                }}
                // 🟢 每一天不同顏色的小圓點
                icon={getMarkerIcon(m.day)}
                // 🔢 圓點中間的編號（同一天內 1,2,3...）
                label={{
                  text: String((m.order || 0) + 1), // m.order 是你在程式裡算好的順序
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              />
            );
          })}





        {/* 🔸 InfoWindow：帶圖片 + 名稱 + 地址 + 連到 Google Maps */}
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
