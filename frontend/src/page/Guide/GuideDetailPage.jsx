import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';
import '../Home/HomePage.css';
import '../../styles/sidebar-shared.css';
import './GuideDetailPage.css';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

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

export default function GuideDetailPage() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { username, guideSlug } = useParams();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const currentPath = location?.pathname || '/';
  const activeSection = new URLSearchParams(location?.search || '').get('section');
  const isGuidesView = (currentPath.startsWith('/u/') && currentPath.includes('/guide/')) || (currentPath === '/' && activeSection === 'guides');
  const isTripsView = currentPath.startsWith('/planner') || (currentPath === '/' && activeSection === 'trips');
  const currentLabel = NAV_ITEMS.find(({ key, path }) =>
    (key === 'home' && currentPath === '/' && activeSection !== 'guides' && activeSection !== 'trips') ||
    (key === 'trips' && isTripsView) ||
    (key === 'guides' && isGuidesView) ||
    (key === 'saved' && currentPath === path)
  )?.label || '旅遊指南';

  const getUserInitial = () => {
    const n = user?.displayName || user?.displayname || user?.email || '?';
    return n.charAt(0).toUpperCase();
  };

  useEffect(() => {
    const controller = new AbortController();

    async function loadGuide() {
      setLoading(true);
      setError('');
      try {
        /**
         * 💡 優化策略：
         * 由於你遇到了 404 與 500 錯誤，我們優先使用最通用的 ID 介面。
         * 如果你的後端支持 /api/guides/:id，這通常是最穩定的路徑。
         */
        const res = await fetch(`${API_BASE}/api/guides/${encodeURIComponent(guideSlug)}`, { 
          signal: controller.signal 
        });

        if (!res.ok) {
          // 針對不同狀態碼給予明確提示
          if (res.status === 404) throw new Error('找不到這篇旅遊指南 (404)');
          if (res.status === 500) throw new Error('伺服器資料處理異常 (500)');
          throw new Error(`載入失敗 (狀態碼: ${res.status})`);
        }

        const data = await res.json();
        
        // 確保 data 內確實含有 guide 物件
        if (!data || !data.guide) {
          throw new Error('回傳資料格式不正確');
        }
        
        setGuide(data.guide);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Fetch Guide Error:', err);
        setError(err.message || '載入指南失敗');
      } finally {
        setLoading(false);
      }
    }

    loadGuide();
    return () => controller.abort();
  }, [guideSlug]);

  // 格式化日期函數 (加入安全檢查)
  const formatDate = (dateStr) => {
    if (!dateStr) return '尚未發布';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '日期格式錯誤';
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // 處理進入 Planner 檢視
  const handleViewInPlanner = () => {
    navigate(`/guides/${encodeURIComponent(guideSlug)}/planner`);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="guide-shell">
          <div className="guide-skeleton" style={{ height: '40px', width: '30%' }} />
          <div className="guide-skeleton" style={{ height: '60px', marginTop: '20px' }} />
          <div className="guide-skeleton guide-skeleton-long" style={{ height: '200px', marginTop: '20px' }} />
        </div>
      );
    }

    if (error || !guide) {
      return (
        <div className="guide-shell guide-error-shell">
          <h1 style={{ color: '#ef4444' }}>抱歉，無法讀取指南</h1>
          <p style={{ margin: '16px 0', color: '#6b7280' }}>原因：{error || '內容不存在'}</p>
          <button type="button" className="guide-back-btn" onClick={() => navigate('/')}>
            回首頁
          </button>
        </div>
      );
    }

    return (
      <article className="guide-shell">
        <button type="button" className="guide-back-btn" onClick={() => navigate(-1)}>
          ← 返回
        </button>

        <header className="guide-header">
          <div className="guide-header-top">
            <div>
              <div className="guide-location">
                {guide?.country ? `${guide.country}・` : ''}
                {guide?.city || '未分類地區'}
              </div>
              <h1>{guide?.title || '未命名指南'}</h1>
              <p className="guide-summary">{guide?.summary || '這份指南尚未提供摘要描述。'}</p>
            </div>
            <button 
              type="button"
              className="guide-planner-btn"
              onClick={handleViewInPlanner}
              title="用 Planner 檢視行程詳情"
            >
              📋 用 Planner 檢視
            </button>
          </div>
        </header>

        <section className="guide-meta-grid">
          <div className="guide-meta-card">
            <div className="guide-meta-label">作者</div>
            <div className="guide-meta-value">{guide?.author?.displayName || '匿名旅人'}</div>
          </div>
          <div className="guide-meta-card">
            <div className="guide-meta-label">旅程天數</div>
            <div className="guide-meta-value">
              {guide?.tripInfo?.days || '--'} 天 {guide?.tripInfo?.nights ? `${guide?.tripInfo?.nights} 夜` : null}
            </div>
          </div>
          <div className="guide-meta-card">
            <div className="guide-meta-label">統計資訊</div>
            <div className="guide-meta-value">{formatDate(guide?.publishedAt)}</div>
          </div>
        </section>

        {Array.isArray(guide?.tags) && guide.tags.length > 0 && (
          <section className="guide-tags">
            {guide.tags.map((tag) => (
              <span key={tag} className="guide-tag">#{tag}</span>
            ))}
          </section>
        )}

        <section className="guide-content">
          {guide?.body ? (
            guide.body.split(/\n+/).filter(Boolean).map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))
          ) : (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>目前尚未提供完整內文。</p>
          )}
        </section>
      </article>
    );
  };

  return (
    <div className="az-root guide-page-root">
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
            {NAV_ITEMS.map(({ key, label, icon, path }) => (
              <button
                key={key}
                className={`az-nav-item${(
                  (key === 'home' && currentPath === '/' && activeSection !== 'guides' && activeSection !== 'trips') ||
                  (key === 'trips' && isTripsView) ||
                  (key === 'guides' && isGuidesView) ||
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

      <div className="az-main">
        <header className="az-topbar">
          <div className="az-topbar-left">
            <button className="az-topbar-btn" onClick={() => setSidebarCollapsed((value) => !value)}>
              <SidebarIcon />
            </button>
            <span className="az-topbar-title">{currentLabel}</span>
          </div>
        </header>

        <div className="az-scroll">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}