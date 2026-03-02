// frontend/src/MapView.jsx
import { useEffect, useMemo, useState, useRef } from 'react';

import {
  GoogleMap,
  Marker,
  InfoWindow,
  useJsApiLoader,
} from '@react-google-maps/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://travel-planner-api-623573920079.asia-east1.run.app';

const dayColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];

const GOOGLE_LIBRARIES = ['places', 'geometry'];

const getDayColor = (day) => {
  if (!day) return '#6366f1';
  return dayColors[(day - 1) % dayColors.length];
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

function MapView({ plan, activeLocation, onLocationChange, onDayChange }) {
  const [markers, setMarkers] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
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

  const [travelMode, setTravelMode] = useState('DRIVING');
  const [selectedSegment, setSelectedSegment] = useState(null);

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
    if (!selectedMarker || !selectedMarker.placeId) {
      setPlaceDetails(null);
      return;
    }

    setLoadingDetails(true);
    setPlaceDetails(null); 

    fetch(`${API_BASE}/api/place-details?placeId=${selectedMarker.placeId}`)
      .then((res) => res.json())
      .then((data) => {
        setPlaceDetails(data);
        if (selectedMarker.isPoi) {
          setSelectedMarker((prev) => ({
            ...prev,
            name: data.name || prev.name,
            address: data.formatted_address || prev.address,
            rating: data.rating,
            userRatingsTotal: data.user_ratings_total,
            photoReference: data.photos?.[0]?.photo_reference,
            type: data.types?.[0], 
          }));
        }
      })
      .catch((err) => console.error('Fetch Details Error', err))
      .finally(() => setLoadingDetails(false));
  }, [selectedMarker?.placeId]);

  useEffect(() => {
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
  }, [selectedDay]);

  // 🔥 關鍵修正：移除 setCityCenter(null)
  useEffect(() => {
    setSelectedDay(null);
    setSelectedMarker(null);
    setSelectedSegment(null);
    setSelectedSegmentInfo(null);
    setLoadingDirections(false);
    setRoutePath(null);
    setSelectedSegmentId(null);
    // 這裡我們不再重置 cityCenter，讓地圖維持在舊位置直到新資料進來
  }, [plan]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: 'AIzaSyDovsqu5FwkMA77_-dkSvBC2jto8w6XuBQ',
    libraries: GOOGLE_LIBRARIES,
  });

  const center = useMemo(() => {
    if (cityCenter) return cityCenter;
    return defaultCenter;
  }, [cityCenter]);

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
        const stableId = `seg-${dayKey}-${i}`;
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
        setSelectedSegmentId(seg.id); 
        setSelectedSegment(seg);
        handleSegmentClick(seg);
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
    if (!plan || !plan.days || plan.days.length === 0) {
      return; 
    }
    if (!isLoaded) return;

    const fetchMarkers = async () => {
      try {
        setLoadingPlaces(true);
        let currentCityLocation = null;
        
        if (plan.city) {
          try {
            const cityRes = await fetch(`${API_BASE}/api/places/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: plan.city }), 
            });
            const cityData = await cityRes.json();
            const cityPlace = cityData.places && cityData.places[0];
            if (cityPlace && cityPlace.lat && cityPlace.lng) {
              currentCityLocation = { lat: cityPlace.lat, lng: cityPlace.lng };
              setCityCenter(currentCityLocation);
            }
          } catch (e) {
            console.error('查詢城市失敗', e);
          }
        }

        const newMarkers = [];
        const seenNames = new Set();
        for (const day of plan.days) {
          const dayNumber = Number(day.day); 
          let orderInDay = 0;
          for (const item of day.items || []) {
            const itemName = item.name?.trim();
            const dedupeKey = `${dayNumber}-${itemName}`;
            if (!itemName || seenNames.has(dedupeKey)) continue;
            seenNames.add(dedupeKey);
            try {
              const res = await fetch(`${API_BASE}/api/places/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  query: itemName, 
                  city: plan.city,
                  center: currentCityLocation 
                }),
              });
              const data = await res.json();
              const place = data.places && data.places[0];
              if (place && place.lat && place.lng) {
                newMarkers.push({
                  lat: place.lat,
                  lng: place.lng,
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
            } catch (err) { console.error(err); }
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
    if (!selectedSegment) return;
    if (directionsAbortRef.current) directionsAbortRef.current.abort();
    setRoutePath(null);
    setSelectedSegmentInfo(null);
    setLoadingDirections(true);
    const t = setTimeout(() => { handleSegmentClick(selectedSegment); }, 50); 
    return () => clearTimeout(t);
  }, [travelMode, selectedSegment]);

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

  async function handleSegmentClick(segment) {
    setRoutePath(null);
    if (directionsAbortRef.current) directionsAbortRef.current.abort();
    const controller = new AbortController();
    directionsAbortRef.current = controller;
    const reqId = ++directionsReqIdRef.current;
    try {
      const res = await fetch(`${API_BASE}/api/directions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          origin: { lat: segment.from.lat, lng: segment.from.lng },
          destination: { lat: segment.to.lat, lng: segment.to.lng },
          mode: travelMode,
        }),
      });
      const data = await res.json();
      if (reqId !== directionsReqIdRef.current) return;
      if (data.encodedPolyline && window.google?.maps?.geometry?.encoding) {
        const decoded = window.google.maps.geometry.encoding.decodePath(data.encodedPolyline);
        setRoutePath(decoded.map((p) => ({ lat: p.lat(), lng: p.lng() })));
      } else {
        setRoutePath(null);
      }
      if (data.bounds && mapRef && window.google) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(data.bounds.northeast);
        bounds.extend(data.bounds.southwest);
        mapRef.fitBounds(bounds);
      }
      if (data.error) setSelectedSegmentInfo({ segment, error: data.error_message || data.error });
      else setSelectedSegmentInfo({ segment, summary: data.summary });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error(err);
      setSelectedSegmentInfo({ segment, error: '取得交通方式失敗' });
    } finally {
      if (reqId === directionsReqIdRef.current) setLoadingDirections(false);
    }
  }

  const renderRouteCard = () => {
    const seg = selectedSegmentInfo?.segment || selectedSegment;
    const summary = selectedSegmentInfo?.summary;
    const err = selectedSegmentInfo?.error;
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
        {loadingDirections ? <div>正在取得交通方式…</div> : err ? <div>{err}</div> : summary ? (
          <div style={{ maxHeight: 120, overflowY: 'auto' }}>
            <div style={{marginBottom:4}}>距離：{summary.distanceText} · 時間：{summary.durationText}</div>
            {(summary.steps || []).map((s, i) => (
              <div key={i} style={{ marginBottom: 4, paddingBottom: 4, borderBottom: '1px dashed #666' }}>
                <div dangerouslySetInnerHTML={{ __html: s.instructionHtml }} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
      
      {loadingPlaces && <div style={{position:'absolute',top:8,left:8,zIndex:1,background:'white',padding:'4px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>取得位 置中…</div>}
      
      {plan?.days?.length > 0 && (
        <div style={{position:'absolute',top:8,right:8,zIndex:2,display:'flex',gap:4,background:'rgba(255,255,255,0.9)',padding:6,borderRadius:99}}>
          <button onClick={() => {setSelectedDay(null);onLocationChange?.(null);}} style={{border:'none',background:selectedDay===null?'#000':'transparent',color:selectedDay===null?'#fff':'#000',borderRadius:99,padding:'2px 8px',cursor:'pointer'}}>全部</button>
          {plan.days.map(d => (
            <button key={d.day} onClick={() => {setSelectedDay(Number(d.day));onLocationChange?.(null);}} 
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
              .filter((m) => {
                if (selectedSegment) {
                   const from = selectedSegment.from;
                   const to = selectedSegment.to;
                   return (m.day === from.day && m.order === from.order) || (m.day === to.day && m.order === to.order);
                }
                return true;
              })
              .map((m) => (
                <Marker
                  key={`${m.day}-${m.order}`}
                  position={{ lat: m.lat, lng: m.lng }}
                  onClick={() => { setSelectedMarker(m); onLocationChange?.({ day: m.day, order: m.order }); }}
                  icon={getMarkerIcon(m.day)}
                  label={{ text: String((m.order || 0) + 1), color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}
                />
              ))}

            {selectedMarker && (
              <InfoWindow position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }} onCloseClick={() => setSelectedMarker(null)}>
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
                              <div key={i} style={{ marginBottom: '8px', fontSize: '11px', color: '#4b5563', borderBottom: '1px dashed #f3f4f6', paddingBottom: '4px' }}>
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