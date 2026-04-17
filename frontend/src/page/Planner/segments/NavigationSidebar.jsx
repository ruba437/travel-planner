import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlanner } from '../PlannerProvider';
import { useAuth } from '../../Authentication/AuthContext';
const NavigationSidebar = () => {
  const { logout, user } = useAuth();
  const { sidebarCollapsed } = usePlanner();
  const navigate = useNavigate();
  const location = useLocation();
  
  const currentPath = location?.pathname || '/';
  const activeSection = new URLSearchParams(location?.search || '').get('section');
  const isGuidesView = currentPath === '/' && activeSection === 'guides';
  const isTripsView = currentPath === '/' && activeSection === 'trips';

  // 取得使用者名稱或 Email 的首字作為頭像
  const getUserInitial = () => {
    const n = user?.displayName || user?.displayname || user?.email || '?';
    return n.charAt(0).toUpperCase();
  };

  return (
    <aside className={`az-sidebar${sidebarCollapsed ? ' az-sidebar--collapsed' : ''}`}>
      <div className="az-sidebar-inner">
        {/* ── Logo 區塊 ── */}
        <div className="az-logo">
          <div className="az-logo-icon">✈</div>
          {!sidebarCollapsed && (
            <div className="az-logo-texts">
              <span className="az-logo-name">旅遊規劃器</span>
              <span className="az-beta-badge">BETA</span>
            </div>
          )}
        </div>

        {/* ── 導航選單 ── */}
        <nav className="az-nav">
          <button
            className={`az-nav-item${currentPath === '/' && !isGuidesView && !isTripsView ? ' az-nav-item--active' : ''}`}
            onClick={() => navigate('/')}
            title={sidebarCollapsed ? '首頁' : ''}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {!sidebarCollapsed && <span>首頁</span>}
          </button>
          
          <button
            className={`az-nav-item${currentPath.startsWith('/planner') || isTripsView ? ' az-nav-item--active' : ''}`}
            onClick={() => {
              if (currentPath.startsWith('/planner')) return;
              navigate('/?section=trips');
            }}
            title={sidebarCollapsed ? '我的行程' : ''}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/>
              <line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
            {!sidebarCollapsed && <span>我的行程</span>}
          </button>

          <button
            className={`az-nav-item${isGuidesView ? ' az-nav-item--active' : ''}`}
            onClick={() => navigate('/?section=guides')}
            title={sidebarCollapsed ? '旅遊指南' : ''}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            {!sidebarCollapsed && <span>旅遊指南</span>}
          </button>

          <button className="az-nav-item" title={sidebarCollapsed ? '收藏' : ''}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            {!sidebarCollapsed && <span>收藏</span>}
          </button>
        </nav>

        <div className="az-nav-spacer" />

        <button className="az-nav-item az-feedback" title={sidebarCollapsed ? '意見回饋' : ''}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {!sidebarCollapsed && <span>意見回饋</span>}
        </button>

        {/* ── 使用者個人資訊與登出 ── */}
        <div className="az-user-row">
          <div className="az-avatar">{getUserInitial()}</div>
          {!sidebarCollapsed && (
            <>
              <div className="az-user-info">
                <span className="az-user-name">{user?.displayName || user?.displayname || '使用者'}</span>
                <span className="az-user-email">{user?.email}</span>
              </div>
              <button className="az-user-chevron" onClick={logout} title="登出">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 3 18 9"/>
                  <polyline points="6 15 12 21 18 15"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

export default NavigationSidebar;