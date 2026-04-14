import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';
import '../../styles/sidebar-shared.css';
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
  { key: 'trips', label: '我的行程', icon: MapIcon, path: '/?section=trips' },
  { key: 'guides', label: '旅遊指南', icon: BookIcon, path: '/?section=guides' },
  { key: 'saved', label: '收藏', icon: BookmarkIcon, path: '/saved' },
];

export default function HomePage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [itineraries, setItineraries] = useState([]);
  const [homeContent, setHomeContent] = useState({ destinations: [], guides: [] });
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [plannerModalOpen, setPlannerModalOpen] = useState(false);
  const [plannerMode, setPlannerMode] = useState('manual');
  const [plannerForm, setPlannerForm] = useState({
    subMode: 'city',
    startLocation: '',
    customDescription: '',
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
      });
    } catch {
      return;
    }
    finally { setContentLoading(false); }
  };

  const fetchItineraries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/itineraries`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItineraries(data.itineraries || []);
    } catch {
      return;
    }
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
  const sectionParam = new URLSearchParams(location?.search || '').get('section');
  const activeSection = ['guides', 'trips'].includes(sectionParam) ? sectionParam : 'all';
  const showTripsSection = activeSection === 'all' || activeSection === 'trips';
  const showDestinationsSection = activeSection === 'all';
  const showGuidesSection = activeSection === 'all' || activeSection === 'guides';

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
    const { startDate, endDate, subMode, startLocation, customDescription, noTimeLimit, durationDays } = plannerForm;

    // 1. 基本驗證：如果是隨性模式，不需要檢查 startDate/endDate
    if (subMode === 'city' && !startLocation) {
      setPlannerFormError('請輸入目的地。');
      return;
    }
    if (subMode === 'custom' && !customDescription) {
      setPlannerFormError('請輸入客製化需求。');
      return;
    }
    if (!noTimeLimit && (!startDate || !endDate)) {
      setPlannerFormError('請輸入旅遊日期區間。');
      return;
    }

    // 2. 決定傳給 PlannerPage 的時間資料
    // 如果沒選日期，我們用今天的日期當起點，根據天數往後推
    const finalStart = noTimeLimit ? new Date().toISOString().split('T')[0] : startDate;
    const days = durationDays || 3;
    const finalEnd = noTimeLimit 
      ? new Date(new Date().getTime() + (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] 
      : endDate;

    // 3. 組合更強大的 Prompt
    let prompt = subMode === 'city' 
      ? `我想去${startLocation}旅遊` 
      : `我的旅遊需求是：${customDescription}`;

    if (noTimeLimit) {
      prompt += `。⚠️請注意：這是一次隨性旅遊，我不需要具體的時間表，請為我規劃約 ${days} 天的建議行程清單即可，時間欄位請用時段（如：上午、下午）表示。`;
    } else {
      prompt += `，日期是從 ${startDate} 到 ${endDate}`;
    }

    navigate('/planner', {
      state: {
        prefill: {
          mode: plannerMode,
          startLocation: subMode === 'city' ? startLocation : '隨性探索',
          startDate: finalStart,
          endDate: finalEnd,
          prompt,
          autoSend: plannerMode === 'ai',
        },
      },
    });
    closePlannerModal();
  };
  
  const currentLabel = NAV_ITEMS.find(({ key, path }) =>
    (key === 'home' && currentPath === '/' && activeSection === 'all') ||
    (key === 'trips' && ((currentPath === '/' && activeSection === 'trips') || currentPath.startsWith('/planner'))) ||
    (key === 'guides' && currentPath === '/' && activeSection === 'guides') ||
    (key === 'saved' && currentPath === path)
  )?.label || '首頁';


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
            {NAV_ITEMS.map(({ key, label, icon, path }) => (
              <button
                key={key}
                className={`az-nav-item${(
                  (key === 'home' && currentPath === '/' && activeSection === 'all') ||
                  (key === 'trips' && ((currentPath === '/' && activeSection === 'trips') || currentPath.startsWith('/planner'))) ||
                  (key === 'guides' && currentPath === '/' && activeSection === 'guides') ||
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
            <span className="az-topbar-title">{currentLabel}</span>
          </div>
        </header>

        <div className="az-scroll">
          {/* My Trips */}
          {showTripsSection && (
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
          {showDestinationsSection && (
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
                      {/* 👇 這是我們全新升級的標籤區塊 */}
                      <div className="az-dest-label">
                        {item.country && <div className="az-dest-country">{item.country}</div>}
                        <div className="az-dest-name-row">
                          <span className="az-dest-city">{item.city}</span>
                          {item.score > 0 && (
                            <span className="az-dest-score">★ {item.score}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Guides */}
          {showGuidesSection && (
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
          )}

          


        </div>
      </div>

      {plannerModalOpen && (
        <div className="az-modal-overlay" onClick={closePlannerModal}>
          <div className="az-modal" onClick={(e) => e.stopPropagation()}>
            <div className="az-modal-header-row">
              <h3>{plannerMode === 'ai' ? 'AI 智慧規劃' : '建立新行程'}</h3>
              {/* 新增模式切換 Tab */}
              {plannerMode === 'ai' && (
                <div className="az-mode-switcher">
                  <button 
                    className={`az-mode-btn ${plannerForm.subMode === 'city' ? 'active' : ''}`}
                    onClick={() => setPlannerForm(prev => ({...prev, subMode: 'city'}))}
                  >目的地</button>
                  <button 
                    className={`az-mode-btn ${plannerForm.subMode === 'custom' ? 'active' : ''}`}
                    onClick={() => setPlannerForm(prev => ({...prev, subMode: 'custom'}))}
                  >客製化需求</button>
                </div>
              )}
            </div>

            <form onSubmit={handlePlannerSubmit} className="az-modal-form">
              {/* 動態切換輸入框 */}
              {plannerForm.subMode === 'city' ? (
                <div>
                  <label className="az-modal-label">想去哪裡？</label>
                  <input
                    name="startLocation"
                    type="text"
                    className="az-modal-input"
                    placeholder="例如：東京、巴黎、高雄..."
                    value={plannerForm.startLocation}
                    onChange={handlePlannerFormChange}
                    autoFocus
                  />
                </div>
              ) : (
                <div>
                  <label className="az-modal-label">告訴 AI 你的旅遊願望</label>
                  <textarea
                    name="customDescription"
                    className="az-modal-input az-modal-textarea"
                    placeholder="例如：想去台南吃美食，要有很多貓咪咖啡廳，預算兩萬內..."
                    value={plannerForm.customDescription || ''}
                    onChange={handlePlannerFormChange}
                    rows="3"
                  />
                </div>
              )}

              {plannerForm.subMode === 'custom' && (
                <div className="az-modal-checkbox-row">
                  <label className="az-modal-checkbox-label">
                    <input
                      type="checkbox"
                      name="noTimeLimit"
                      checked={plannerForm.noTimeLimit || false}
                      onChange={(e) => setPlannerForm(prev => ({ ...prev, noTimeLimit: e.target.checked }))}
                    />
                    <span>我不想要死板的時間表（改為推薦景點清單）</span>
                  </label>
                </div>
              )}

              {!plannerForm.noTimeLimit ? (
                <div className="az-modal-dates">
                  <div>
                    <label className="az-modal-label">出發日期</label>
                    <input name="startDate" type="date" className="az-modal-input" value={plannerForm.startDate} onChange={handlePlannerFormChange} />
                  </div>
                  <div>
                    <label className="az-modal-label">結束日期</label>
                    <input name="endDate" type="date" className="az-modal-input" value={plannerForm.endDate} onChange={handlePlannerFormChange} />
                  </div>
                </div>
              ) : (
                /* 隨性模式：改問「預計玩幾天？」 */
                <div>
                  <label className="az-modal-label">預計旅遊天數（選填，預設 3 天）</label>
                  <input 
                    name="durationDays" 
                    type="number" 
                    min="1" 
                    max="30"
                    className="az-modal-input" 
                    placeholder="例如：3" 
                    value={plannerForm.durationDays || ''} 
                    onChange={handlePlannerFormChange} 
                  />
                </div>
              )}

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