import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { useAuth } from '../Authentication/AuthContext';
import { useFavorites } from '../Authentication/FavoritesContext';
import FavoriteButton from '../../components/FavoriteButton';
import '../../styles/sidebar-shared.css';
import './CityGuidePage.css';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const GOOGLE_LIBRARIES = [];
const DEFAULT_CENTER = { lat: 35.6762, lng: 139.6503 };

// ─── 分類對應後端 category key ────────────────────────────────
const CATEGORY_KEY = {
  places:      'places',
  hotels:      'hotels',
  restaurants: 'restaurants',
  activities:  'activities',
  // transport 不支援收藏
};

function toFiniteCoord(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getCityCenter(city) {
  const lat = toFiniteCoord(city?.latitude);
  const lng = toFiniteCoord(city?.longitude);
  if (lat !== null && lng !== null) return { lat, lng };
  return DEFAULT_CENTER;
}

function buildPlaceMarkers(places = []) {
  return places
    .map((place) => {
      const lat = toFiniteCoord(place?.latitude);
      const lng = toFiniteCoord(place?.longitude);
      if (lat === null || lng === null) return null;

      return {
        id: String(place.id),
        position: { lat, lng },
        name: place.name || '景點',
        description: place.description || '',
        image: place.cover_image || '',
      };
    })
    .filter(Boolean);
}

function slugToCityText(raw) {
  if (!raw) return '';
  return decodeURIComponent(raw).replace(/-/g, ' ').trim();
}

/* ── Icons ── */
function HomeIcon()     { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function MapIcon()      { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>; }
function BookIcon()     { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>; }
function BookmarkIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>; }
function UsersIcon()    { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function FeedbackIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function SidebarIcon()  { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>; }
function ChevronUpDownIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 3 18 9"/><polyline points="6 15 12 21 18 15"/></svg>; }

const NAV_ITEMS = [
  { key: 'home',   label: '首頁',    icon: HomeIcon,     path: '/' },
  { key: 'trips',  label: '我的行程', icon: MapIcon,      path: '/?section=trips' },
  { key: 'guides', label: '旅遊指南', icon: BookIcon,     path: '/?section=guides' },
  { key: 'saved',  label: '收藏',    icon: BookmarkIcon, path: '/saved' },
];

// ─── Skeleton ─────────────────────────────────────────────
function SkeletonCard() {
  return (
    <article className="cg-book-card cg-skeleton">
      <div className="cg-book-card-img cg-skeleton-img" />
      <div className="cg-book-card-body">
        <div className="cg-skeleton-line" style={{ width: '70%' }} />
        <div className="cg-skeleton-line" style={{ width: '50%', marginTop: 6 }} />
      </div>
    </article>
  );
}

const POI_CATEGORY_MAP = {
  places: 'place',
  hotels: 'hotel',
  restaurants: 'restaurant',
  activities: 'activity',
  transport: 'transport',
};

function CardRow({
  title,
  categoryKey,
  items,
  transport = false,
  loading,
  isFavorited,
  onAddToItinerary,
}) {
  return (
    <section className="cg-section">
      <h2 className="cg-section-title">{title}</h2>
      <div className="cg-scroll-row">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : items.length === 0
            ? <p className="cg-empty">暫無資料</p>
            : items.map((item) => {
                const canSave = !!categoryKey;
                return (
                  <article key={item.id} className="cg-book-card">
                    <div className="cg-book-card-img">
                      {transport || !item.cover_image
                        ? <div className="cg-transport-icon">🚇</div>
                        : <img src={item.cover_image} alt={item.name} loading="lazy" />
                      }
                      {canSave && (
                        <FavoriteButton
                          itemId={item.id}
                          itemType="poi"
                          metadata={{
                            name: item.name,
                            image_url: item.cover_image,
                            address: item.description,
                            lat: item.latitude ?? null,
                            lng: item.longitude ?? null,
                          }}
                          size="md"
                          className="cg-favorite-btn"
                          onToggle={(saved) => {
                            if (saved) {
                              onAddToItinerary?.({
                                ...item,
                                poiCategory: POI_CATEGORY_MAP[categoryKey] || item.category || 'place',
                              });
                            }
                          }}
                        />
                      )}
                      {canSave && isFavorited?.(item.id, 'poi') && (
                        <button
                          type="button"
                          className="cg-add-btn"
                          onClick={() => onAddToItinerary?.({
                            ...item,
                            poiCategory: POI_CATEGORY_MAP[categoryKey] || item.category || 'place',
                          })}
                        >
                          加入行程
                        </button>
                      )}
                    </div>
                    <div className="cg-book-card-body">
                      <div className="cg-book-card-name">{item.name}</div>
                      <div className="cg-book-card-desc">
                        {item.star_rating ? `${item.star_rating} ★` : item.description || ''}
                      </div>
                      {item.book_url && (
                        <button
                          className="cg-book-btn"
                          type="button"
                          onClick={() => window.open(item.book_url, '_blank', 'noopener,noreferrer')}
                        >
                          Book
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
        }
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════
export default function CityGuidePage() {
  const { city }    = useParams();
  const navigate    = useNavigate();
  const location    = useLocation();
  const { user, token, logout } = useAuth();
  const { isFavorited } = useFavorites();
  const isAuthenticated = Boolean(token);

  const [guideData, setGuideData]           = useState(null);      // null = 尚未載入
  const [loading,   setLoading]             = useState(true);
  const [error,     setError]               = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [itineraries, setItineraries] = useState([]);
  const [itinerariesLoading, setItinerariesLoading] = useState(false);
  const [selectedItineraryUuid, setSelectedItineraryUuid] = useState('');
  const [selectedItineraryDetail, setSelectedItineraryDetail] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activePoi, setActivePoi] = useState(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [mapRef, setMapRef] = useState(null);
  const [activeMarkerId, setActiveMarkerId] = useState(null);
  const [placeDetailsByMarkerId, setPlaceDetailsByMarkerId] = useState({});
  const [placeDetailsLoadingId, setPlaceDetailsLoadingId] = useState(null);

  const cityText   = useMemo(() => slugToCityText(city), [city]);
  const currentPath = location?.pathname || '/';
  const activeSection = new URLSearchParams(location?.search || '').get('section');
  const currentSection = isAuthenticated ? activeSection : undefined;
  const visibleNavItems = NAV_ITEMS.filter(({ key }) => isAuthenticated || (key !== 'trips' && key !== 'saved'));

  useEffect(() => {
    document.title = cityText ? `${cityText} 城市指南 | Travel Planner` : '城市指南 | Travel Planner';
  }, [cityText]);

  const loadItineraries = useCallback(async () => {
    if (!token) {
      setItineraries([]);
      return;
    }

    setItinerariesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/itineraries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json?.itineraries) throw new Error('取得行程列表失敗');
      setItineraries(Array.isArray(json.itineraries) ? json.itineraries : []);
    } catch (fetchError) {
      console.error(fetchError);
      setItineraries([]);
    } finally {
      setItinerariesLoading(false);
    }
  }, [token]);

  const loadItineraryDetail = useCallback(async (uuid) => {
    if (!uuid || !token) {
      setSelectedItineraryDetail(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/itineraries/${encodeURIComponent(uuid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json?.itineraryData) throw new Error('取得行程詳情失敗');
      setSelectedItineraryDetail(json);
      setSelectedDayIndex(0);
    } catch (fetchError) {
      console.error(fetchError);
      setSelectedItineraryDetail(null);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadItineraries();
    } else {
      setItineraries([]);
      setSelectedItineraryUuid('');
      setSelectedItineraryDetail(null);
    }
  }, [token, loadItineraries]);

  useEffect(() => {
    if (!isAddModalOpen || !selectedItineraryUuid) return;
    loadItineraryDetail(selectedItineraryUuid);
  }, [isAddModalOpen, selectedItineraryUuid, loadItineraryDetail]);

  useEffect(() => {
    if (!isAddModalOpen) {
      setActivePoi(null);
      setAddError('');
      setAddSubmitting(false);
    }
  }, [isAddModalOpen]);

  useEffect(() => {
    if (isAddModalOpen && itineraries.length > 0 && !selectedItineraryUuid) {
      setSelectedItineraryUuid(itineraries[0].uuid);
    }
  }, [isAddModalOpen, itineraries, selectedItineraryUuid]);

  const openAddToItineraryModal = useCallback((poi) => {
    if (!token) {
      alert('請先登入');
      return;
    }

    setActivePoi({
      id: String(poi.id),
      name: poi.name,
      image_url: poi.cover_image,
      address: poi.description,
      poiCategory: poi.poiCategory || poi.category || 'place',
    });
    setAddError('');
    setIsAddModalOpen(true);
    if (itineraries.length === 0) {
      loadItineraries();
    }
    if (itineraries[0]?.uuid) {
      setSelectedItineraryUuid((current) => current || itineraries[0].uuid);
    }
  }, [itineraries, loadItineraries, token]);

  const closeAddToItineraryModal = useCallback(() => {
    setIsAddModalOpen(false);
    setActivePoi(null);
    setAddError('');
  }, []);

  const handleAddToItinerary = useCallback(async () => {
    if (!token) {
      alert('請先登入');
      return;
    }
    if (!activePoi || !selectedItineraryUuid) {
      setAddError('請先選擇行程');
      return;
    }

    setAddSubmitting(true);
    setAddError('');
    try {
      const res = await fetch(`${API_BASE}/api/itineraries/${encodeURIComponent(selectedItineraryUuid)}/add-favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itemId: String(activePoi.id),
          itemType: 'poi',
          targetDayIndex: selectedDayIndex,
          poiCategory: activePoi.poiCategory,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || '加入行程失敗');
      }

      closeAddToItineraryModal();
      alert('已加入行程');
    } catch (submitError) {
      setAddError(submitError.message || '加入行程失敗');
    } finally {
      setAddSubmitting(false);
    }
  }, [activePoi, closeAddToItineraryModal, selectedDayIndex, selectedItineraryUuid, token]);

  const getUserInitial = () => {
    const n = user?.displayName || user?.displayname || user?.email || '?';
    return n.charAt(0).toUpperCase();
  };

  // ── 載入城市 guide ─────────────────────────────────────────
  useEffect(() => {
    if (!cityText) return;
    const controller = new AbortController();

    async function loadGuide() {
      setLoading(true);
      setError(null);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(
          `${API_BASE}/api/cities/${encodeURIComponent(cityText)}/guide`,
          { headers, signal: controller.signal }
        );
        if (res.status === 404) throw new Error('找不到此城市的資料');
        if (!res.ok) throw new Error('伺服器發生錯誤，請稍後再試');
        const json = await res.json();
        if (!json.success || !json.data) throw new Error('資料格式錯誤');
        setGuideData(json.data);
      } catch (e) {
        if (e.name === 'AbortError') return;
        setError(e.message || '載入失敗');
      } finally {
        setLoading(false);
      }
    }

    loadGuide();
    return () => controller.abort();
  }, [cityText, token]);

  // ─── Error / Empty state ──────────────────────────────────
  if (!loading && error) {
    return (
      <div className="cg-root">
        <div className="az-main" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="cg-error-state">
            <p>😕 {error}</p>
            <button onClick={() => navigate(-1)}>← 返回</button>
          </div>
        </div>
      </div>
    );
  }

  const guide = guideData || {};
  const cityData = guide.city || {};
  const selectedItineraryDays = selectedItineraryDetail?.itineraryData?.days || [];
  const { isLoaded } = useJsApiLoader({
    id: 'city-guide-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_LIBRARIES,
  });
  const placeMarkers = useMemo(() => buildPlaceMarkers(guide.places || []), [guide.places]);
  const mapCenter = useMemo(() => getCityCenter(cityData), [cityData]);

  useEffect(() => {
    setActiveMarkerId(null);
    setPlaceDetailsByMarkerId({});
    setPlaceDetailsLoadingId(null);
  }, [cityText]);

  useEffect(() => {
    if (!mapRef || !window.google?.maps) return;

    if (placeMarkers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      placeMarkers.forEach((marker) => bounds.extend(marker.position));
      mapRef.fitBounds(bounds);
      return;
    }

    mapRef.panTo(mapCenter);
    mapRef.setZoom(12);
  }, [mapCenter, mapRef, placeMarkers]);

  const activeMarker = placeMarkers.find((marker) => marker.id === activeMarkerId) || null;
  const activeMarkerDetails = activeMarker ? placeDetailsByMarkerId[activeMarker.id] : null;

  const loadMarkerDetails = useCallback(async (marker) => {
    if (!marker) return;
    if (placeDetailsByMarkerId[marker.id]) return;

    setPlaceDetailsLoadingId(marker.id);
    try {
      const searchRes = await fetch(`${API_BASE}/api/places/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: marker.name,
          city: cityData.city || cityText,
          center: mapCenter,
        }),
      });

      const searchJson = await searchRes.json();
      const placeId = searchJson?.places?.[0]?.placeId;
      if (!placeId) {
        setPlaceDetailsByMarkerId((current) => ({
          ...current,
          [marker.id]: { error: '找不到 Google Place 資料' },
        }));
        return;
      }

      const detailRes = await fetch(`${API_BASE}/api/places/details?placeId=${encodeURIComponent(placeId)}`);
      const detailJson = await detailRes.json();
      setPlaceDetailsByMarkerId((current) => ({
        ...current,
        [marker.id]: detailJson || { error: '取得 Google 詳情失敗' },
      }));
    } catch (err) {
      setPlaceDetailsByMarkerId((current) => ({
        ...current,
        [marker.id]: { error: err?.message || '取得 Google 詳情失敗' },
      }));
    } finally {
      setPlaceDetailsLoadingId((current) => (current === marker.id ? null : current));
    }
  }, [cityData.city, cityText, mapCenter, placeDetailsByMarkerId]);

  useEffect(() => {
    if (!activeMarker) return;
    loadMarkerDetails(activeMarker);
  }, [activeMarker, loadMarkerDetails]);

  const activeMarkerPhotoRef = activeMarkerDetails?.photos?.[0]?.photo_reference || null;
  const activeMarkerReviews = Array.isArray(activeMarkerDetails?.reviews) ? activeMarkerDetails.reviews.slice(0, 2) : [];

  return (
    <div className="cg-root">
      {/* ── Sidebar ── */}
      <aside className={`az-sidebar${sidebarCollapsed ? ' az-sidebar--collapsed' : ''}`}>
        <div className="az-sidebar-inner">
          <button
            type="button"
            className="az-logo"
            onClick={() => navigate('/')}
            title={sidebarCollapsed ? '回到首頁' : '回到首頁'}
            aria-label="回到首頁"
          >
            <div className="az-logo-icon">✈</div>
            {!sidebarCollapsed && (
              <div className="az-logo-texts">
                <span className="az-logo-name">Rêverie 旅遊規劃器</span>
              </div>
            )}
          </button>

          <nav className="az-nav">
            {visibleNavItems.map(({ key, label, icon, path }) => (
              <button
                key={key}
                className={`az-nav-item${(
                  (key === 'home' && currentPath === '/' && !['guides', 'trips'].includes(currentSection)) ||
                  (key === 'trips' && ((currentPath === '/' && currentSection === 'trips') || currentPath.startsWith('/planner'))) ||
                  (key === 'guides' && currentPath === '/' && currentSection === 'guides') ||
                  (key === 'saved' && currentPath === path)
                ) ? ' az-nav-item--active' : ''}`}
                onClick={() => navigate(path)}
                title={sidebarCollapsed ? label : ''}
              >
                {icon()}
                {!sidebarCollapsed && <span>{label}</span>}
              </button>
            ))}
          </nav>

          <div className="az-nav-spacer" />

          <button className="az-nav-item az-feedback" title={sidebarCollapsed ? '意見回饋' : ''}>
            <FeedbackIcon />
            {!sidebarCollapsed && <span>意見回饋</span>}
          </button>

          {token ? (
            <div
              className="az-user-row"
              onClick={() => navigate('/settings/profile')}
              role="button"
              tabIndex={0}
              title="個人設定"
              onKeyDown={(e) => e.key === 'Enter' && navigate('/settings/profile')}
            >
              <div className="az-avatar">{getUserInitial()}</div>
              {!sidebarCollapsed && (
                <>
                  <div className="az-user-info">
                    <span className="az-user-name">{user?.displayName || user?.displayname || ''}</span>
                    <span className="az-user-email">{user?.email}</span>
                  </div>
                  <button className="az-user-chevron" onClick={(e) => { e.stopPropagation(); logout(); }} title="登出">
                    <ChevronUpDownIcon />
                  </button>
                </>
              )}
            </div>
          ) : (
            <button className="az-nav-item" onClick={() => navigate('/login')}>
              <UsersIcon />
              {!sidebarCollapsed && <span>登入</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="az-main">
        <header className="az-topbar">
          <div className="az-topbar-left">
            <button className="az-topbar-btn" onClick={() => setSidebarCollapsed(v => !v)}>
              <SidebarIcon />
            </button>
            <span className="az-topbar-title">熱門目的地</span>
          </div>
        </header>

        <div className="az-scroll">
          {/* Hero */}
          <section className="cg-hero">
            {loading
              ? <div className="cg-skeleton-hero" />
              : <img src={cityData.cover_image} alt={cityData.city} />
            }
            <h1>{cityData.city || cityText}</h1>
          </section>

          <div className="cg-content">
            {loading
              ? <div className="cg-skeleton-line" style={{ width: '80%', height: 16, marginBottom: 24 }} />
              : <p className="cg-description">{cityData.description}</p>
            }

            {!loading && (
              <div className="cg-map-wrap">
                {!isLoaded ? (
                  <div className="cg-map-loading">地圖載入中…</div>
                ) : (
                  <GoogleMap
                    mapContainerClassName="cg-map"
                    center={mapCenter}
                    zoom={12}
                    onLoad={(map) => setMapRef(map)}
                    onClick={() => setActiveMarkerId(null)}
                    options={{
                      disableDefaultUI: false,
                      clickableIcons: false,
                      fullscreenControl: false,
                      mapTypeControl: false,
                      streetViewControl: false,
                    }}
                  >
                    {placeMarkers.map((marker) => (
                      <Marker
                        key={marker.id}
                        position={marker.position}
                        onClick={() => {
                          setActiveMarkerId(marker.id);
                        }}
                      />
                    ))}

                    {activeMarker && (
                      <InfoWindow
                        position={activeMarker.position}
                        onCloseClick={() => setActiveMarkerId(null)}
                      >
                        <div className="cg-map-info-window">
                          <div className="cg-map-info-title">{activeMarker.name}</div>
                          {placeDetailsLoadingId === activeMarker.id ? (
                            <div className="cg-map-info-text">載入 Google 圖片與評論中…</div>
                          ) : activeMarkerDetails?.error ? (
                            <div className="cg-map-info-text">{activeMarkerDetails.error}</div>
                          ) : (
                            <>
                              {activeMarkerPhotoRef && (
                                <img
                                  className="cg-map-info-photo"
                                  src={`${API_BASE}/api/places/photo?ref=${encodeURIComponent(activeMarkerPhotoRef)}&maxwidth=320`}
                                  alt={activeMarker.name}
                                />
                              )}
                              {typeof activeMarkerDetails?.rating === 'number' && (
                                <div className="cg-map-info-rating">
                                  {activeMarkerDetails.rating} ★
                                  {activeMarkerDetails.user_ratings_total ? ` · ${activeMarkerDetails.user_ratings_total} 則評論` : ''}
                                </div>
                              )}
                              {activeMarker.description && (
                                <div className="cg-map-info-text">{activeMarker.description}</div>
                              )}
                              {activeMarkerReviews.length > 0 && (
                                <div className="cg-map-info-reviews">
                                  {activeMarkerReviews.map((review, index) => (
                                    <div key={`${review.author_name || 'review'}-${index}`} className="cg-map-review-item">
                                      <div className="cg-map-review-meta">
                                        <span>{review.author_name || '匿名評論者'}</span>
                                        {review.rating ? <span>{review.rating} ★</span> : null}
                                      </div>
                                      <div className="cg-map-review-text">{review.text}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </InfoWindow>
                    )}
                  </GoogleMap>
                )}
              </div>
            )}

            {/* Top Places */}
            <section className="cg-section">
              <h2 className="cg-section-title">Top Places</h2>
              <div className="cg-scroll-row">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="cg-place-pill cg-skeleton">
                        <div className="cg-skeleton-img" style={{ height: '100%' }} />
                      </div>
                    ))
                  : (guide.places || []).length === 0
                    ? <p className="cg-empty">暫無景點資料</p>
                    : (guide.places || []).map((p) => {
                        return (
                          <article key={p.id} className="cg-place-pill">
                            <img src={p.cover_image} alt={p.name} loading="lazy" />
                            <div className="cg-place-overlay">{p.name}</div>
                            <FavoriteButton
                              itemId={p.id}
                              itemType="poi"
                              metadata={{
                                name: p.name,
                                image_url: p.cover_image,
                                address: p.description,
                                lat: p.latitude ?? null,
                                lng: p.longitude ?? null,
                              }}
                              size="md"
                              className="cg-favorite-btn"
                              onToggle={(saved) => {
                                if (saved) {
                                  openAddToItineraryModal({
                                    ...p,
                                    poiCategory: 'place',
                                  });
                                }
                              }}
                            />
                            {isFavorited(p.id, 'poi') && (
                              <button
                                type="button"
                                className="cg-add-btn cg-add-btn--pill"
                                onClick={() => openAddToItineraryModal({
                                  ...p,
                                  poiCategory: 'place',
                                })}
                              >
                                加入行程
                              </button>
                            )}
                          </article>
                        );
                      })
                }
              </div>
            </section>

            <CardRow title="Hotels"        categoryKey="hotels"      items={guide.hotels      || []} loading={loading} isFavorited={isFavorited} onAddToItinerary={openAddToItineraryModal} />
            {(loading || (guide.restaurants || []).length > 0) && (
              <CardRow
                title="Restaurants"
                categoryKey="restaurants"
                items={guide.restaurants || []}
                loading={loading}
                isFavorited={isFavorited}
                onAddToItinerary={openAddToItineraryModal}
              />
            )}
            <CardRow title="Things to Do"  categoryKey="activities"  items={guide.activities   || []} loading={loading} isFavorited={isFavorited} onAddToItinerary={openAddToItineraryModal} />

          </div>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="cg-modal-backdrop" role="presentation" onClick={closeAddToItineraryModal}>
          <div className="cg-modal" role="dialog" aria-modal="true" aria-label="加入行程" onClick={(e) => e.stopPropagation()}>
            <div className="cg-modal-header">
              <div>
                <div className="cg-modal-kicker">加入行程</div>
                <h3>{activePoi?.name || '選擇景點'}</h3>
              </div>
              <button type="button" className="cg-modal-close" onClick={closeAddToItineraryModal}>×</button>
            </div>

            <div className="cg-modal-body">
              <div className="cg-modal-preview">
                {activePoi?.image_url ? <img src={activePoi.image_url} alt={activePoi?.name || '景點'} /> : <div className="cg-modal-preview-fallback">✈</div>}
                <div>
                  <div className="cg-modal-title">{activePoi?.name || ''}</div>
                  <div className="cg-modal-text">{activePoi?.address || '這個景點會被加入到選定行程的當天尾端。'}</div>
                </div>
              </div>

              <label className="cg-modal-field">
                <span>選擇行程</span>
                <select
                  value={selectedItineraryUuid}
                  onChange={(e) => setSelectedItineraryUuid(e.target.value)}
                  disabled={itinerariesLoading || itineraries.length === 0}
                >
                  {itineraries.length === 0 ? (
                    <option value="">沒有可用行程</option>
                  ) : itineraries.map((itinerary) => (
                    <option key={itinerary.uuid} value={itinerary.uuid}>
                      {itinerary.title || itinerary.summary || itinerary.uuid}
                    </option>
                  ))}
                </select>
              </label>

              <label className="cg-modal-field">
                <span>選擇天數</span>
                <select
                  value={selectedDayIndex}
                  onChange={(e) => setSelectedDayIndex(Number(e.target.value))}
                  disabled={!selectedItineraryDays.length}
                >
                  {selectedItineraryDays.length === 0 ? (
                    <option value="0">沒有可用天數</option>
                  ) : selectedItineraryDays.map((day, index) => (
                    <option key={index} value={index}>
                      第 {index + 1} 天{day?.title ? `：${day.title}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {addError && <div className="cg-modal-error">{addError}</div>}
            </div>

            <div className="cg-modal-footer">
              <button type="button" className="cg-modal-secondary" onClick={closeAddToItineraryModal}>
                取消
              </button>
              <button
                type="button"
                className="cg-modal-primary"
                onClick={handleAddToItinerary}
                disabled={addSubmitting || !selectedItineraryUuid || !selectedItineraryDays.length}
              >
                {addSubmitting ? '加入中…' : '加入行程'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}