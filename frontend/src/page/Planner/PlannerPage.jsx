import React, { useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { PlannerProvider, usePlanner } from './PlannerProvider';

// 匯入子區段 (Segments)
import NavigationSidebar from './segments/NavigationSidebar';
import TripHeroHeader from './segments/TripHeroHeader';
import DayTabNavigator from './segments/DayTabNavigator';
import ItineraryTimeline from './segments/ItineraryTimeline';
import PrepChecklist from './segments/PrepChecklist';
import ExpenseTracker from './segments/ExpenseTracker';
import AiAssistantPanel from './segments/AiAssistantPanel';

// 匯入共用組件 (路徑對應 src/components/MapView.jsx)
import MapView from '../../components/MapView';

// 匯入共用 Sidebar 樣式與頁面樣式
import '../../styles/sidebar-shared.css';
import './PlannerStyles.css';

/**
 * PlannerContent: 持有 UI 佈局與自動發送邏輯
 */
const PlannerContent = ({ isPublicMode = false }) => {
  const { 
    activeTab, 
    setActiveTab, 
    sidebarCollapsed, 
    setSidebarCollapsed,
    showAiPanel,
    setShowAiPanel,
    isSaving,
    isAutoSaving,
    hasUnsavedChanges,
    saveMsg,
    isLoadingItinerary,
    plan,
    setPlan,
    activeLocation,
    setActiveLocation,
    setActiveDayIdx,
    recalculateDayTimesAsync,
    token,
    // 從 Provider 取得自動發送需要的狀態
    handleSend,
    setInput
  } = usePlanner();

  const location = useLocation();
  const { uuid: itineraryUuidParam } = useParams();
  const hasAppliedPrefill = useRef(false); // 用於確保自動發送只執行一次

  // ── 🚀 自動處理首頁傳來的 AI 請求 ──
  useEffect(() => {
    // 只做一件事情：把首頁傳來的文字填入輸入框，其他的交給 Provider
    if (itineraryUuidParam || hasAppliedPrefill.current) return;

    const prefill = location?.state?.prefill;
    if (!prefill || !prefill.prompt) return;

    hasAppliedPrefill.current = true; // 鎖定
    setInput(prefill.prompt); // 只填入文字

    if (prefill.autoSend) {
      setShowAiPanel(true); // 只打開面板
      console.log("🎯 已將指令填入，等待 Provider 執行...");
    }
  }, [location.pathname, location.search, itineraryUuidParam]); // ⚠️ 依賴陣列保持簡單且固定

  // ── 處理從地圖點擊「加入行程」的邏輯 ──
  const handleAddLocation = async (locationData) => {
    if (!plan || !plan.days || plan.days.length === 0 || locationData.targetDayIndex === undefined) {
      alert('請先讓 AI 產生一個基本的行程，才能手動加入景點喔！');
      return;
    }
    
    const targetDayIdx = locationData.targetDayIndex;
    const newPlan = { ...plan, days: [...plan.days] };
    const dayItems = [...(plan.days[targetDayIdx].items || [])];
    
    const newItem = { 
      name: locationData.name, 
      type: locationData.type || 'sight', 
      time: '', 
      cost: 0, 
      note: `手動從地圖加入`, 
      location: { lat: locationData.lat, lng: locationData.lng },
      placeId: locationData.placeId || null,
      photoReference: locationData.photoReference || null,
    };
    
    dayItems.push(newItem);
    const dayStartTime = plan.days[targetDayIdx].startTime || '09:00';
    const updatedItems = await recalculateDayTimesAsync(dayItems, dayStartTime, token);
    
    newPlan.days[targetDayIdx] = { 
      ...plan.days[targetDayIdx], 
      items: updatedItems 
    };
    
    setPlan(newPlan);
    setActiveDayIdx(targetDayIdx);
    setActiveLocation({ day: targetDayIdx + 1, order: updatedItems.length - 1 });
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
      {!isPublicMode && <NavigationSidebar />}

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

          {/* 公開模式隱藏 AI 按鈕 */}
          {!isPublicMode && (
            <button 
              className={`az-topbar-btn ${showAiPanel ? 'az-topbar-btn--active' : ''}`} 
              onClick={() => setShowAiPanel(!showAiPanel)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
              </svg>
              AI 助手
            </button>
          )}

          <div className="az-topbar-status">
            {isPublicMode && <span className="az-status-text" style={{ fontSize: '12px', color: '#999' }}>公開預覽模式</span>}
            {!isPublicMode && (isAutoSaving || isSaving) && <span className="az-status-text">保存中...</span>}
            {!isPublicMode && !isAutoSaving && !isSaving && hasUnsavedChanges && (
              <span className="az-status-text">保存中...</span>
            )}
            {saveMsg && (
              <span className={`az-save-msg ${saveMsg === '已保存' ? 'az-save-msg--ok' : 'az-save-msg--err'}`}>
                {saveMsg}
              </span>
            )}
          </div>

          <div className="az-topbar-spacer" />

          <button className="az-topbar-icon-btn" title="查看導航">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16 10,8"/>
            </svg>
          </button>
        </header>

        {/* 內容包裹區 */}
        <div className="az-content-wrap">
          
          {/* ── 左側行程面板 ── */}
          <div className="az-trip-panel">
            <TripHeroHeader isReadOnly={isPublicMode} />

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

            <div className="az-tab-content">
              {activeTab === 'info' ? (
                <>
                  <PrepChecklist isReadOnly={isPublicMode} />
                  <ExpenseTracker isReadOnly={isPublicMode} />
                </>
              ) : (
                <>
                  <DayTabNavigator isReadOnly={isPublicMode} />
                  <h2 className="az-itinerary-heading">行程詳情</h2>
                  <ItineraryTimeline isReadOnly={isPublicMode} />
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
              onAddLocation={isPublicMode ? null : handleAddLocation}
              isReadOnly={isPublicMode}
            />
          </div>
        </div>
      </div>

      {/* ── 浮動 AI 助手面板（公開模式不顯示） ── */}
      {!isPublicMode && showAiPanel && <AiAssistantPanel />}
    </div>
  );
};

/**
 * PlannerPage: 導出組件
 */
const PlannerPage = ({ isPublicMode = false }) => {
  return (
    <PlannerProvider isPublicMode={isPublicMode}>
      <PlannerContent isPublicMode={isPublicMode} />
    </PlannerProvider>
  );
};

export default PlannerPage;