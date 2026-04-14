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
    if (itineraryUuidParam || hasAppliedPrefill.current) return;

    const prefill = location?.state?.prefill;
    if (!prefill) return;

    const { startLocation, startDate, endDate, autoSend, prompt } = prefill;
    
    // 檢查點：確保至少有 Prompt 或基本資訊
    if (!prompt && (!startLocation || !startDate || !endDate)) return;

    // 建立一個初始的空的 Plan 框架，防止畫面崩潰
    const buildDraftPlan = () => {
      const start = new Date(startDate || new Date());
      const end = new Date(endDate || new Date());
      const msPerDay = 24 * 60 * 60 * 1000;
      const rawDayCount = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
      const dayCount = (Number.isFinite(rawDayCount) && rawDayCount > 0) ? rawDayCount : 1;

      return {
        tripName: `${startLocation || '新行程'}之旅`,
        summary: '',
        city: startLocation || '',
        startDate: startDate || new Date().toISOString().split('T')[0],
        startTime: '09:00',
        note: '',
        days: Array.from({ length: dayCount }, (_, index) => ({
          day: index + 1,
          title: `第 ${index + 1} 天`,
          startTime: '09:00',
          items: [],
        })),
        totalBudget: 0,
        tags: [],
      };
    };

    hasAppliedPrefill.current = true;
    
    if (prompt) {
      setInput(prompt); 
      
      if (autoSend) {
        setShowAiPanel(true);
        // 重要：先建立一個空骨架，讓 MapView 等組件有東西可以渲染，不會噴 Error
        setPlan(buildDraftPlan());

        const timer = setTimeout(() => {
          handleSend(prompt); // 這裡發送給後端 AI
        }, 600); // 稍微延遲，確保 Provider 狀態已更新

        return () => clearTimeout(timer);
      }
    }

    if (!autoSend) {
      setPlan(prevPlan => prevPlan || buildDraftPlan());
    }
  }, [location, itineraryUuidParam, handleSend, setInput, setShowAiPanel, setPlan]);

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
      location: { lat: locationData.lat, lng: locationData.lng } 
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