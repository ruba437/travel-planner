import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';
import './CityGuidePage.css';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ─── 分類對應後端 category key ────────────────────────────────
const CATEGORY_KEY = {
  places:      'places',
  hotels:      'hotels',
  restaurants: 'restaurants',
  activities:  'activities',
  // transport 不支援收藏
};

function buildMapSrc(city) {
  if (!city) return 'https://www.google.com/maps?q=35.6762,139.6503&z=11&output=embed';
  if (city.latitude && city.longitude)
    return `https://www.google.com/maps?q=${city.latitude},${city.longitude}&z=11&output=embed`;
  const q = encodeURIComponent(`${city.city || ''} ${city.country || ''}`.trim());
  return `https://www.google.com/maps?q=${q}&z=11&output=embed`;
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
  { key: 'trips',  label: '我的行程', icon: MapIcon,      path: '/trips' },
  { key: 'guides', label: '旅遊指南', icon: BookIcon,     path: '/guides' },
  { key: 'saved',  label: '收藏',    icon: BookmarkIcon, path: '/saved' },
  { key: 'buddy',  label: '尋找旅伴', icon: UsersIcon,    path: '/buddy' },
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

function CardRow({ title, categoryKey, items, transport = false, onToggleSave, savedSet, loading }) {
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
                const isSaved = savedSet.has(`${categoryKey}:${item.id}`);
                return (
                  <article key={item.id} className="cg-book-card">
                    <div className="cg-book-card-img">
                      {transport || !item.cover_image
                        ? <div className="cg-transport-icon">🚇</div>
                        : <img src={item.cover_image} alt={item.name} loading="lazy" />
                      }
                      {canSave && (
                        <button
                          className={`cg-heart ${isSaved ? 'is-saved' : ''}`}
                          onClick={() => onToggleSave(categoryKey, item.id)}
                          type="button"
                        >
                          {isSaved ? '♥' : '♡'}
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

  const [guideData, setGuideData]           = useState(null);      // null = 尚未載入
  const [savedSet,  setSavedSet]            = useState(new Set());
  const [loading,   setLoading]             = useState(true);
  const [error,     setError]               = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const cityText   = useMemo(() => slugToCityText(city), [city]);
  const currentPath = location?.pathname || '/';

  const getUserInitial = () => {
    const n = user?.displayName || user?.displayname || user?.email || '?';
    return n.charAt(0).toUpperCase();
  };

  // ── 初始化 savedSet（從 API 回傳的 is_saved 欄位）──────────
  const initSavedSet = useCallback((data) => {
    const s = new Set();
    const cats = ['places','hotels','restaurants','activities'];
    cats.forEach(cat => {
      (data[cat] || []).forEach(item => {
        if (item.is_saved) s.add(`${cat}:${item.id}`);
      });
    });
    setSavedSet(s);
  }, []);

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
        initSavedSet(json.data);
      } catch (e) {
        if (e.name === 'AbortError') return;
        setError(e.message || '載入失敗');
      } finally {
        setLoading(false);
      }
    }

    loadGuide();
    return () => controller.abort();
  }, [cityText, token, initSavedSet]);

  // ── 收藏 toggle ────────────────────────────────────────────
  const onToggleSave = useCallback(async (categoryKey, id) => {
    if (!token) { navigate('/login'); return; }

    const key    = `${categoryKey}:${id}`;
    const wasSaved = savedSet.has(key);

    // optimistic update
    setSavedSet(prev => {
      const next = new Set(prev);
      wasSaved ? next.delete(key) : next.add(key);
      return next;
    });

    try {
      const res = await fetch(
        `${API_BASE}/api/pois/${categoryKey}/${id}/save`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Save failed');
    } catch (_e) {
      // rollback
      setSavedSet(prev => {
        const next = new Set(prev);
        wasSaved ? next.add(key) : next.delete(key);
        return next;
      });
    }
  }, [token, savedSet, navigate]);

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

  return (
    <div className="cg-root">
      {/* ── Sidebar ── */}
      <aside className={`az-sidebar${sidebarCollapsed ? ' az-sidebar--collapsed' : ''}`}>
        <div className="az-sidebar-inner">
          <div className="az-logo">
            <div className="az-logo-icon">✈</div>
            {!sidebarCollapsed && (
              <div className="az-logo-texts">
                <span className="az-logo-name">旅遊規劃器</span>
                <span className="az-beta-badge">BETA</span>
              </div>
            )}
          </div>

          <nav className="az-nav">
            {NAV_ITEMS.map(({ key, label, icon: Icon, path }) => (
              <button
                key={key}
                className={`az-nav-item${currentPath === path ? ' az-nav-item--active' : ''}`}
                onClick={() => navigate(path)}
                title={sidebarCollapsed ? label : ''}
              >
                <Icon />
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
            <div className="az-user-row">
              <div className="az-avatar">{getUserInitial()}</div>
              {!sidebarCollapsed && (
                <>
                  <div className="az-user-info">
                    <span className="az-user-name">{user?.displayName || user?.displayname || ''}</span>
                    <span className="az-user-email">{user?.email}</span>
                  </div>
                  <button className="az-user-chevron" onClick={logout} title="登出">
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

            {!loading && cityData.latitude && (
              <div className="cg-map-wrap">
                <iframe title="city map" src={buildMapSrc(cityData)} loading="lazy" />
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
                        const isSaved = savedSet.has(`places:${p.id}`);
                        return (
                          <article key={p.id} className="cg-place-pill">
                            <img src={p.cover_image} alt={p.name} loading="lazy" />
                            <div className="cg-place-overlay">{p.name}</div>
                            <button
                              className={`cg-heart ${isSaved ? 'is-saved' : ''}`}
                              onClick={() => onToggleSave('places', p.id)}
                              type="button"
                            >
                              {isSaved ? '♥' : '♡'}
                            </button>
                          </article>
                        );
                      })
                }
              </div>
            </section>

            <CardRow title="Hotels"        categoryKey="hotels"      items={guide.hotels      || []} onToggleSave={onToggleSave} savedSet={savedSet} loading={loading} />
            <CardRow title="Restaurants"   categoryKey="restaurants" items={guide.restaurants  || []} onToggleSave={onToggleSave} savedSet={savedSet} loading={loading} />
            <CardRow title="Things to Do"  categoryKey="activities"  items={guide.activities   || []} onToggleSave={onToggleSave} savedSet={savedSet} loading={loading} />
            <CardRow title="Getting There" categoryKey={null}        items={guide.transport    || []} transport onToggleSave={onToggleSave} savedSet={savedSet} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
}