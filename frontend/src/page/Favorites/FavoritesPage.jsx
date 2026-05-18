import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';
import { useFavorites } from '../Authentication/FavoritesContext';
import FavoriteButton from '../../components/FavoriteButton';
import '../../styles/sidebar-shared.css';
import './FavoritesPage.css';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

function HomeIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
}

function MapIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg>;
}

function BookIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>;
}

function BookmarkIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>;
}

function UsersIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}

function SidebarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>;
}

function ChevronIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 3 18 9" /><polyline points="6 15 12 21 18 15" /></svg>;
}

const NAV_ITEMS = [
  { key: 'home',   label: '首頁',   icon: HomeIcon,     path: '/' },
  { key: 'trips',  label: '我的行程', icon: MapIcon,      path: '/?section=trips' },
  { key: 'guides', label: '旅遊指南', icon: BookIcon,     path: '/?section=guides' },
  { key: 'saved',  label: '收藏',   icon: BookmarkIcon, path: '/saved' },
];

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=900&q=80';

const formatDate = (value) => {
  if (!value) return '剛收藏';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '剛收藏';
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const getFavoriteImage = (fav) => fav?.image_url || FALLBACK_IMAGE;
const canAddToItinerary = (fav) => ['poi', 'attraction'].includes(fav?.item_type);

export default function FavoritesPage() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const { favoritesList, loading, fetchFavorites } = useFavorites();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [itineraries, setItineraries] = useState([]);
  const [itinerariesLoading, setItinerariesLoading] = useState(false);
  const [selectedItineraryUuid, setSelectedItineraryUuid] = useState('');
  const [selectedItineraryDetail, setSelectedItineraryDetail] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFavorite, setActiveFavorite] = useState(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const currentPath = '/saved';
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter(({ key }) => token || (key !== 'trips' && key !== 'saved')),
    [token],
  );

  useEffect(() => { document.title = '收藏 | Rêverie 旅遊規劃器'; }, []);

  const getUserInitial = () => {
    const value = user?.displayName || user?.displayname || user?.email || '?';
    return value.charAt(0).toUpperCase();
  };

  const loadItineraries = useCallback(async () => {
    if (!token) { setItineraries([]); return []; }
    setItinerariesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/itineraries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json?.itineraries) throw new Error('取得行程列表失敗');
      const list = Array.isArray(json.itineraries) ? json.itineraries : [];
      setItineraries(list);
      return list;
    } catch (err) {
      console.error(err);
      setItineraries([]);
      return [];
    } finally {
      setItinerariesLoading(false);
    }
  }, [token]);

  const loadItineraryDetail = useCallback(async (uuid) => {
    if (!uuid || !token) { setSelectedItineraryDetail(null); return null; }
    try {
      const res = await fetch(`${API_BASE}/api/itineraries/${encodeURIComponent(uuid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json?.itineraryData) throw new Error('取得行程詳情失敗');
      setSelectedItineraryDetail(json);
      setSelectedDayIndex(0);
      return json;
    } catch (err) {
      console.error(err);
      setSelectedItineraryDetail(null);
      return null;
    }
  }, [token]);

  useEffect(() => {
    if (!isModalOpen) { setActiveFavorite(null); setAddError(''); setAddSubmitting(false); }
  }, [isModalOpen]);

  useEffect(() => {
    if (isModalOpen && itineraries.length > 0 && !selectedItineraryUuid) {
      setSelectedItineraryUuid(itineraries[0].uuid);
    }
  }, [isModalOpen, itineraries.length, selectedItineraryUuid]);

  useEffect(() => {
    if (!isModalOpen || !selectedItineraryUuid) return;
    loadItineraryDetail(selectedItineraryUuid);
  }, [isModalOpen, selectedItineraryUuid, loadItineraryDetail]);

  useEffect(() => {
    if (token) { loadItineraries(); fetchFavorites(); }
    else { setItineraries([]); setSelectedItineraryUuid(''); setSelectedItineraryDetail(null); }
  }, [token, fetchFavorites, loadItineraries]);

  const openAddToItineraryModal = useCallback(async (fav) => {
    if (!token) { alert('請先登入'); return; }
    if (!canAddToItinerary(fav)) return;
    setActiveFavorite(fav);
    setAddError('');
    setIsModalOpen(true);
    if (itineraries.length === 0) {
      const list = await loadItineraries();
      if (list?.[0]?.uuid) setSelectedItineraryUuid(list[0].uuid);
      return;
    }
    setSelectedItineraryUuid((c) => c || itineraries[0]?.uuid || '');
  }, [itineraries, loadItineraries, token]);

  const closeModal = useCallback(() => { setIsModalOpen(false); setAddError(''); }, []);

  const handleAddToItinerary = useCallback(async () => {
    if (!token) { alert('請先登入'); return; }
    if (!activeFavorite || !selectedItineraryUuid) { setAddError('請先選擇行程'); return; }
    setAddSubmitting(true);
    setAddError('');
    try {
      const res = await fetch(
        `${API_BASE}/api/itineraries/${encodeURIComponent(selectedItineraryUuid)}/add-favorite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            itemId: String(activeFavorite.item_id),
            itemType: activeFavorite.item_type,
            targetDayIndex: selectedDayIndex,
            poiCategory: activeFavorite.item_type === 'attraction' ? 'activity' : 'place',
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || '加入行程失敗');
      closeModal();
      alert('已加入行程');
    } catch (err) {
      setAddError(err.message || '加入行程失敗');
    } finally {
      setAddSubmitting(false);
    }
  }, [activeFavorite, closeModal, selectedDayIndex, selectedItineraryUuid, token]);

  const currentDays = selectedItineraryDetail?.itineraryData?.days || [];

  return (
    <div className="az-root saved-root">

      {/* ── 側欄 ── */}
      <aside className={`az-sidebar${sidebarCollapsed ? ' az-sidebar--collapsed' : ''}`}>
        <div className="az-sidebar-inner">
          <button type="button" className="az-logo" onClick={() => navigate('/')} aria-label="回到首頁">
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
                className={`az-nav-item${currentPath === path ? ' az-nav-item--active' : ''}`}
                onClick={() => navigate(path)}
                title={sidebarCollapsed ? label : ''}
              >
                {icon()}
                {!sidebarCollapsed && <span>{label}</span>}
              </button>
            ))}
          </nav>

          <div className="az-nav-spacer" />

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
                    <span className="az-user-name">{user?.displayName || user?.displayname || '使用者'}</span>
                    <span className="az-user-email">{user?.email}</span>
                  </div>
                  <button
                    className="az-user-chevron"
                    onClick={(e) => { e.stopPropagation(); logout(); }}
                    title="登出"
                  >
                    <ChevronIcon />
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

      {/* ── 主內容 ── */}
      <main className="az-main saved-main">

        {/* Topbar — 與首頁完全一致 */}
        <div className="saved-topbar">
          <button
            type="button"
            className="saved-topbar-btn"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? '展開側欄' : '收合側欄'}
          >
            <SidebarIcon />
          </button>
          <span className="saved-topbar-title">收藏</span>
        </div>

        {/* Scroll area */}
        <div className="saved-scroll">
          {/* Cards section */}
          <section className="saved-section">
            <div className="saved-section-head">
              <h2 className="saved-h2">
                所有收藏
              </h2>
            </div>

            {loading ? (
              <div className="saved-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="saved-card saved-card--skeleton" />
                ))}
              </div>
            ) : favoritesList.length === 0 ? (
              <div className="saved-empty">
                <div className="saved-empty-emoji">🔖</div>
                <h2>目前還沒有收藏</h2>
                <p>到城市指南或景點頁先收藏幾個喜歡的地點吧。</p>
                <button
                  type="button"
                  className="saved-empty-btn"
                  onClick={() => navigate('/?section=guides')}
                >
                  去找景點
                </button>
              </div>
            ) : (
              <div className="saved-grid">
                {favoritesList.map((fav) => (
                  <article key={`${fav.item_type}-${fav.item_id}`} className="saved-card">
                    <div className="saved-card-media">
                      <img
                        src={getFavoriteImage(fav)}
                        alt={fav.name || '收藏項目'}
                        onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                      />
                      <div className="saved-card-overlay">
                        <FavoriteButton
                          itemId={fav.item_id}
                          itemType={fav.item_type}
                          metadata={{
                            name: fav.name,
                            image_url: fav.image_url,
                            address: fav.address,
                            lat: fav.lat,
                            lng: fav.lng,
                          }}
                          size="md"
                          className="saved-favorite-button"
                        />
                      </div>
                    </div>

                    <div className="saved-card-body">
                      <div className="saved-card-head">
                        <h2>{fav.name || '未命名收藏'}</h2>
                        {/* <span className={`saved-type saved-type--${fav.item_type}`}>
                          {fav.item_type}
                        </span> */}
                      </div>
                      <p className="saved-card-address">{fav.address || '尚未提供地址'}</p>
                      <p className="saved-card-meta">收藏於 {formatDate(fav.created_at)}</p>

                      <div className="saved-card-actions">
                        <button
                          type="button"
                          className="saved-action saved-action--primary"
                          onClick={() => openAddToItineraryModal(fav)}
                          disabled={!canAddToItinerary(fav)}
                          title={!canAddToItinerary(fav) ? '行程收藏不可再加入行程' : '加入行程'}
                        >
                          加入行程
                        </button>
                        <button
                          type="button"
                          className="saved-action saved-action--ghost"
                          onClick={() => navigate('/planner')}
                        >
                          行程規劃
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

        </div>{/* end .saved-scroll */}
      </main>

      {/* ── Modal ── */}
      {isModalOpen && (
        <div className="saved-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="saved-modal"
            role="dialog"
            aria-modal="true"
            aria-label="加入行程"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="saved-modal-header">
              <div>
                <p className="saved-modal-kicker">加入行程</p>
                <h3>{activeFavorite?.name || '選擇收藏項目'}</h3>
              </div>
              <button type="button" className="saved-modal-close" onClick={closeModal}>×</button>
            </div>

            <div className="saved-modal-body">
              <div className="saved-modal-preview">
                <img
                  src={getFavoriteImage(activeFavorite)}
                  alt={activeFavorite?.name || '收藏項目'}
                  onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                />
                <div>
                  <div className="saved-modal-title">{activeFavorite?.name || ''}</div>
                  <div className="saved-modal-text">
                    {activeFavorite?.address || '加入到所選行程的指定天數。'}
                  </div>
                </div>
              </div>

              <label className="saved-modal-field">
                <span>選擇行程</span>
                <select
                  value={selectedItineraryUuid}
                  onChange={(e) => setSelectedItineraryUuid(e.target.value)}
                  disabled={itinerariesLoading || itineraries.length === 0}
                >
                  {itineraries.length === 0
                    ? <option value="">沒有可用行程</option>
                    : itineraries.map((it) => (
                      <option key={it.uuid} value={it.uuid}>
                        {it.title || it.summary || it.uuid}
                      </option>
                    ))}
                </select>
              </label>

              <label className="saved-modal-field">
                <span>選擇天數</span>
                <select
                  value={selectedDayIndex}
                  onChange={(e) => setSelectedDayIndex(Number(e.target.value))}
                  disabled={!currentDays.length}
                >
                  {currentDays.length === 0
                    ? <option value="0">沒有可用天數</option>
                    : currentDays.map((day, i) => (
                      <option key={i} value={i}>
                        第 {i + 1} 天{day?.title ? `：${day.title}` : ''}
                      </option>
                    ))}
                </select>
              </label>

              {addError && <div className="saved-modal-error">{addError}</div>}
            </div>

            <div className="saved-modal-footer">
              <button type="button" className="saved-modal-secondary" onClick={closeModal}>取消</button>
              <button
                type="button"
                className="saved-modal-primary"
                onClick={handleAddToItinerary}
                disabled={addSubmitting || !selectedItineraryUuid || !currentDays.length}
              >
                {addSubmitting ? '加入中⋯' : '加入行程'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}