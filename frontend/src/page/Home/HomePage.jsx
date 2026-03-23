import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';
import './HomePage.css';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const DESTINATION_IMAGES = {
  '東京': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80',
  '香港': 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=400&q=80',
  '曼谷': 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&q=80',
  '大阪': 'https://images.unsplash.com/photo-1590559899731-a382839e5549?w=400&q=80',
  '首爾': 'https://images.unsplash.com/photo-1617369120004-4fc70312c5e6?w=400&q=80',
  '台北': 'https://images.unsplash.com/photo-1470004914212-05527e49370b?w=400&q=80',
  '京都': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80',
  '新加坡': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&q=80',
  'Tokyo': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80',
  'Hong Kong': 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=400&q=80',
  'Bangkok': 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&q=80',
  'Osaka': 'https://images.unsplash.com/photo-1590559899731-a382839e5549?w=400&q=80',
  'Seoul': 'https://images.unsplash.com/photo-1617369120004-4fc70312c5e6?w=400&q=80',
};
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&q=80';

function getImg(city) {
  return DESTINATION_IMAGES[city] || FALLBACK_IMG;
}

/* ── Icons ── */
function HomeIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function MapIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>;
}
function BookIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
}
function BookmarkIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
}
function UsersIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function DotsIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>;
}
function SparkleIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>;
}
function FeedbackIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function SidebarIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>;
}
function ChevronUpDownIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 3 18 9"/><polyline points="6 15 12 21 18 15"/></svg>;
}

const NAV_ITEMS = [
  { key: 'home', label: '首頁', icon: HomeIcon, path: '/' },
  { key: 'trips', label: '我的行程', icon: MapIcon, path: '/trips' },
  { key: 'guides', label: '旅遊指南', icon: BookIcon, path: '/guides' },
  { key: 'saved', label: '收藏', icon: BookmarkIcon, path: '/saved' },
  { key: 'buddy', label: '尋找旅伴', icon: UsersIcon, path: '/buddy' },
];

export default function HomePage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [itineraries, setItineraries] = useState([]);
  const [homeContent, setHomeContent] = useState({ destinations: [], guides: [], buddyPosts: [], publicTrips: [] });
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [plannerModalOpen, setPlannerModalOpen] = useState(false);
  const [plannerMode, setPlannerMode] = useState('manual');
  const [plannerForm, setPlannerForm] = useState({
    startLocation: '',
    startDate: '',
    endDate: '',
  });
  const [plannerFormError, setPlannerFormError] = useState('');

  useEffect(() => { fetchHomeContent(); }, []);
  useEffect(() => {
    if (!token) { setLoading(false); setItineraries([]); return; }
    fetchItineraries();
  }, [token]);

  const fetchHomeContent = async () => {
    setContentLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/home/content`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHomeContent({
        destinations: data.destinations || [],
        guides: data.guides || [],
        buddyPosts: data.buddyPosts || [],
        publicTrips: data.publicTrips || [],
      });
    } catch { }
    finally { setContentLoading(false); }
  };

  const fetchItineraries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/itineraries`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItineraries(data.itineraries || []);
    } catch { }
    finally { setLoading(false); }
  };

  const handleDelete = async (uuid) => {
    if (!window.confirm('確定要刪除這個行程嗎？')) return;
    setDeletingId(uuid);
    setOpenMenu(null);
    try {
      const res = await fetch(`${API_BASE}/api/itineraries/${uuid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setItineraries((prev) => prev.filter((it) => it.uuid !== uuid));
    } catch { alert('刪除失敗'); }
    finally { setDeletingId(null); }
  };

  const fmt = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fmtRange = (s, e) => {
    if (!s) return 'No dates set';
    if (!e) return fmt(s);
    return `${fmt(s)} - ${fmt(e)}`;
  };

  const getUserInitial = () => {
    const n = user?.displayName || user?.displayname || user?.email || '?';
    return n.charAt(0).toUpperCase();
  };

  const currentPath = location?.pathname || '/';

  const openPlannerModal = (mode) => {
    setPlannerMode(mode);
    setPlannerFormError('');
    setPlannerModalOpen(true);
  };

  const closePlannerModal = () => {
    setPlannerModalOpen(false);
    setPlannerFormError('');
  };

  const handlePlannerFormChange = (e) => {
    const { name, value } = e.target;
    setPlannerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlannerSubmit = (e) => {
    e.preventDefault();

    const startLocation = plannerForm.startLocation.trim();
    const { startDate, endDate } = plannerForm;

    if (!startLocation || !startDate || !endDate) {
      setPlannerFormError('請完整輸入起點與旅遊區間。');
      return;
    }

    if (endDate < startDate) {
      setPlannerFormError('旅遊結束日期不可早於出發日期。');
      return;
    }

    const prompt = `請幫我規劃旅程，起點是${startLocation}，旅遊日期從${startDate}到${endDate}。`;

    navigate('/planner', {
      state: {
        prefill: {
          mode: plannerMode,
          startLocation,
          startDate,
          endDate,
          prompt,
          autoSend: plannerMode === 'ai',
        },
      },
    });
    closePlannerModal();
  };

  return (
    <div className="az-root" onClick={() => setOpenMenu(null)}>
      {/* Sidebar */}
      <aside className={`az-sidebar${sidebarCollapsed ? ' az-sidebar--collapsed' : ''}`}>
        <div className="az-sidebar-inner">
          {/* Logo */}
          <div className="az-logo">
            <div className="az-logo-icon">✈</div>
            {!sidebarCollapsed && (
              <div className="az-logo-texts">
                <span className="az-logo-name">旅遊規劃器</span>
                <span className="az-beta-badge">BETA</span>
              </div>
            )}
          </div>

          {/* Nav */}
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

          {/* Bottom */}
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

      {/* Main area */}
      <div className="az-main">
        {/* Top bar */}
        <header className="az-topbar">
          <div className="az-topbar-left">
            <button
              className="az-topbar-btn"
              onClick={(e) => { e.stopPropagation(); setSidebarCollapsed(v => !v); }}
            >
              <SidebarIcon />
            </button>
            <span className="az-topbar-title">首頁</span>
          </div>
        </header>

        <div className="az-scroll">
          {/* My Trips */}
          {token && (
            <section className="az-section">
              <div className="az-section-head">
                <h2 className="az-h2">我的行程</h2>
                <div className="az-head-actions">
                  <button className="az-btn az-btn--outline" onClick={() => openPlannerModal('manual')}>自己規劃</button>

                  
                  <button className="az-btn az-btn--ai" onClick={() => openPlannerModal('ai')}>
                    <SparkleIcon /> AI 智慧規劃
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="az-trip-grid">
                  {[1,2,3].map(i => <div key={i} className="az-trip-card az-skel" />)}
                </div>
              ) : itineraries.length === 0 ? (
                <div className="az-empty">
                  <div className="az-empty-emoji">🗺️</div>
                  <p>還沒有任何行程</p>
                  <button className="az-btn az-btn--ai" onClick={() => openPlannerModal('ai')}>
                    <SparkleIcon /> 開始規劃第一趟旅程
                  </button>
                </div>
              ) : (
                <div className="az-trip-grid">
                  {itineraries.map((it) => (
                    <div key={it.uuid} className="az-trip-card" onClick={() => navigate(`/planner/${it.uuid}`)}>
                      <div className="az-trip-imgwrap">
                        <img
                          src={getImg(it.city)}
                          alt={it.city || ''}
                          className="az-trip-img"
                          onError={e => { e.target.src = FALLBACK_IMG; }}
                        />
                        <button
                          className="az-trip-dots"
                          onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === it.uuid ? null : it.uuid); }}
                        >
                          <DotsIcon />
                        </button>
                        {openMenu === it.uuid && (
                          <div className="az-dropdown" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { navigate(`/planner/${it.uuid}`); setOpenMenu(null); }}>編輯行程</button>
                            <button
                              className="az-dropdown--danger"
                              disabled={deletingId === it.uuid}
                              onClick={() => handleDelete(it.uuid)}
                            >
                              {deletingId === it.uuid ? '刪除中...' : '刪除行程'}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="az-trip-body">
                        <div className="az-trip-name">{it.title || it.city || '無標題'}</div>
                        <div className="az-trip-date">{fmtRange(it.startdate, it.enddate)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Popular Destinations */}
          <section className="az-section">
            <h2 className="az-h2">熱門目的地</h2>
            {contentLoading ? (
              <div className="az-dest-grid">
                {[1,2,3,4,5].map(i => <div key={i} className="az-dest-card az-skel" />)}
              </div>
            ) : (
              <div className="az-dest-grid">
                {homeContent.destinations.map((item, i) => (
                  <div
                    key={i}
                    className="az-dest-card"
                    onClick={() => {
                      const citySlug = encodeURIComponent((item.city || '').trim().replace(/\s+/g, '-'));
                      if (citySlug) navigate(`/city/${citySlug}/guide`);
                    }}
                  >
                    <img
                      src={getImg(item.city)}
                      alt={item.city}
                      className="az-dest-img"
                      onError={e => { e.target.src = FALLBACK_IMG; }}
                    />
                    <div className="az-dest-label">{item.city}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Guides */}
          <section className="az-section">
            <h2 className="az-h2">旅遊指南</h2>
            {contentLoading ? (
              <div className="az-guide-grid">
                {[1,2,3,4,5].map(i => <div key={i} className="az-guide-card az-skel" />)}
              </div>
            ) : (
              <div className="az-guide-grid">
                {homeContent.guides.map((guide) => (
                  <div
                    key={guide.id}
                    className="az-guide-card"
                    onClick={() => {
                      const username = guide.authorUsername || 'travel-planner';
                      const slug = guide.slug || guide.id || '';
                      if (slug) navigate(`/u/${encodeURIComponent(username)}/guide/${encodeURIComponent(slug)}`);
                    }}
                  >
                    <div className="az-guide-imgwrap">
                      <img
                        src={getImg(guide.city)}
                        alt={guide.city || ''}
                        className="az-guide-img"
                        onError={e => { e.target.src = FALLBACK_IMG; }}
                      />
                    </div>
                    <div className="az-guide-body">
                      {guide.city && <span className="az-guide-tag">{guide.city}</span>}
                      <div className="az-guide-title">{guide.title}</div>
                      <div className="az-guide-meta">
                        <span>{guide.authorName}</span>
                        {guide.publishedAt && <span>{fmt(guide.publishedAt)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Buddy */}
          {homeContent.buddyPosts.length > 0 && (
            <section className="az-section">
              <h2 className="az-h2">尋找旅伴</h2>
              <div className="az-buddy-grid">
                {homeContent.buddyPosts.map((buddy) => (
                  <div key={buddy.id} className="az-buddy-card">
                    <div className="az-buddy-city">{buddy.city || '未指定城市'}</div>
                    <div className="az-buddy-date">
                      {buddy.startDate && buddy.endDate
                        ? `${fmt(buddy.startDate)} - ${fmt(buddy.endDate)}`
                        : '日期待確認'}
                    </div>
                    <p className="az-buddy-note">{buddy.note || '正在尋找旅伴一起規劃旅程。'}</p>
                    <div className="az-buddy-by">發起人：{buddy.displayName}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Public Trips (logged-out) */}
          {!token && homeContent.publicTrips.length > 0 && (
            <section className="az-section">
              <h2 className="az-h2">公開旅程</h2>
              <div className="az-guide-grid">
                {homeContent.publicTrips.map((trip) => (
                  <div key={trip.uuid} className="az-guide-card" onClick={() => navigate('/login')}>
                    <div className="az-guide-imgwrap">
                      <img src={getImg(trip.city)} alt={trip.city || ''} className="az-guide-img" onError={e => { e.target.src = FALLBACK_IMG; }} />
                    </div>
                    <div className="az-guide-body">
                      {trip.city && <span className="az-guide-tag">{trip.city}</span>}
                      <div className="az-guide-title">{trip.title}</div>
                      <div className="az-guide-meta"><span>{trip.authorName}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {plannerModalOpen && (
        <div className="az-modal-overlay" onClick={closePlannerModal}>
          <div className="az-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{plannerMode === 'ai' ? 'AI 智慧規劃' : '建立新行程'}</h3>
            <p className="az-modal-desc">進入規劃前，請先輸入起點與旅遊區間。</p>

            <form onSubmit={handlePlannerSubmit} className="az-modal-form">
              <label className="az-modal-label" htmlFor="planner-start-location">起點</label>
              <input
                id="planner-start-location"
                name="startLocation"
                type="text"
                className="az-modal-input"
                placeholder="例如：台北車站、桃園機場"
                value={plannerForm.startLocation}
                onChange={handlePlannerFormChange}
                autoFocus
              />

              <div className="az-modal-dates">
                <div>
                  <label className="az-modal-label" htmlFor="planner-start-date">出發日期</label>
                  <input
                    id="planner-start-date"
                    name="startDate"
                    type="date"
                    className="az-modal-input"
                    value={plannerForm.startDate}
                    onChange={handlePlannerFormChange}
                  />
                </div>
                <div>
                  <label className="az-modal-label" htmlFor="planner-end-date">結束日期</label>
                  <input
                    id="planner-end-date"
                    name="endDate"
                    type="date"
                    className="az-modal-input"
                    value={plannerForm.endDate}
                    onChange={handlePlannerFormChange}
                  />
                </div>
              </div>

              {plannerFormError && <div className="az-modal-error">{plannerFormError}</div>}

              <div className="az-modal-actions">
                <button type="button" className="az-btn az-btn--outline" onClick={closePlannerModal}>取消</button>
                <button type="submit" className="az-btn az-btn--ai">開始規劃</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}