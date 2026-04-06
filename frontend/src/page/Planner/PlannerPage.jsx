import React from 'react';
import { PlannerProvider, usePlanner } from './PlannerProvider';

// 匯入子區段 (Segments) - 這些檔案我們稍後會逐一建立
import NavigationSidebar from './segments/NavigationSidebar';
import TripHeroHeader from './segments/TripHeroHeader';
import DayTabNavigator from './segments/DayTabNavigator';
import ItineraryTimeline from './segments/ItineraryTimeline';
import PrepChecklist from './segments/PrepChecklist';
import ExpenseTracker from './segments/ExpenseTracker';
import AiAssistantPanel from './segments/AiAssistantPanel';

// 匯入共用組件
import MapView from '../../components/MapView';

// 匯入樣式
import './PlannerStyles.css';

/**
 * PlannerContent: 真正持有 UI 佈局的組件
 * 必須包裹在 PlannerProvider 內才能使用 usePlanner()
 */
const PlannerContent = () => {
  const { 
    activeTab, 
    setActiveTab, 
    sidebarCollapsed, 
    setSidebarCollapsed,
    showAiPanel,
    setShowAiPanel,
    isSaving,
    isAutoSaving,
    saveMsg,
    isLoadingItinerary,
    plan,
    activeLocation,
    setActiveLocation,
    setActiveDayIdx
  } = usePlanner();

  // 處理地圖加入景點的轉發邏輯
  const handleAddLocation = (data) => {
    // 這裡的邏輯可以留在這，或移入 Provider
    console.log("Map Add Location:", data);
  };

  return (
    <div className="az-root">
      {/* 載入中遮罩 */}
      {isLoadingItinerary && (
        <div className="az-loading-overlay">
          <div className="az-spinner" />
          <p>載入行程中...</p>
        </div>
      )}

      {/* ── 左側導航側邊欄 ── */}
      <NavigationSidebar />

      {/* ── 主要內容區 ── */}
      <div className="az-main">
        
        {/* 頂部工具列 (Topbar) */}
        <header className="az-topbar">
          <button className="az-topbar-icon-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>

          <button 
            className={`az-topbar-btn ${showAiPanel ? 'az-topbar-btn--active' : ''}`} 
            onClick={() => setShowAiPanel(!showAiPanel)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
            </svg>
            AI 助手
          </button>

          <div className="az-topbar-status">
            {isAutoSaving || isSaving ? '保存中...' : ''}
            {saveMsg && (
              <span className={`az-save-msg ${saveMsg === '已保存' ? 'az-save-msg--ok' : 'az-save-msg--err'}`}>
                {saveMsg}
              </span>
            )}
          </div>

          <div className="az-topbar-spacer" />

          <button className="az-topbar-icon-btn" title="導出行程">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16 10,8"/>
            </svg>
          </button>
        </header>

        {/* 內容包裹區 (行程編輯 + 地圖) */}
        <div className="az-content-wrap">
          
          {/* ── 左側行程面板 ── */}
          <div className="az-trip-panel">
            {/* 行程封面與標題 */}
            <TripHeroHeader />

            {/* 功能標籤切換 */}
            <div className="az-tabs">
              <button 
                className={`az-tab ${activeTab === 'info' ? 'az-tab--active' : ''}`} 
                onClick={() => setActiveTab('info')}
              >
                資訊
              </button>
              <button 
                className={`az-tab ${activeTab === 'itinerary' ? 'az-tab--active' : ''}`} 
                onClick={() => setActiveTab('itinerary')}
              >
                行程
              </button>
            </div>

            {/* 標籤內容區 */}
            <div className="az-tab-content">
              {activeTab === 'info' ? (
                <>
                  <PrepChecklist />
                  <ExpenseTracker />
                </>
              ) : (
                <>
                  <DayTabNavigator />
                  <h2 className="az-itinerary-heading">行程詳情</h2>
                  <ItineraryTimeline />
                </>
              )}
            </div>
          </div>

          {/* ── 右側地圖面板 ── */}
          <div className="az-map-panel">
            <MapView 
              plan={plan}
              activeLocation={activeLocation}
              onLocationChange={setActiveLocation}
              onDayChange={(day) => { if (day !== null) setActiveDayIdx(day - 1); }}
              onAddLocation={handleAddLocation}
            />
          </div>
        </div>
      </div>

      {/* ── 浮動 AI 助手面板 ── */}
      {showAiPanel && <AiAssistantPanel />}
    </div>
  );
};

/**
 * PlannerPage: 導出組件
 * 使用 Provider 包裹 Content，確保 Context 生效
 */
const PlannerPage = () => {
  return (
    <PlannerProvider>
      <PlannerContent />
    </PlannerProvider>
  );
};

export default PlannerPage;