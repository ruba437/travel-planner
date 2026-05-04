import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { PlannerProvider, usePlanner, API_BASE } from './PlannerProvider'; // 確保導出 API_BASE

// 匯入子區段 (Segments)
import NavigationSidebar from './segments/NavigationSidebar';
import TripHeroHeader from './segments/TripHeroHeader';
import DayTabNavigator from './segments/DayTabNavigator';
import ItineraryTimeline from './segments/ItineraryTimeline';
import PrepChecklist from './segments/PrepChecklist';
import ExpenseTracker from './segments/ExpenseTracker';
import AiAssistantPanel from './segments/AiAssistantPanel';
import ProposalPreviewer from './segments/ProposalPreviewer';

// 匯入共用組件
import MapView from '../../components/MapView';

// 匯入樣式
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
    setIsLoadingItinerary, // 確保從 Provider 導出此方法
    plan, 
    setPlan,
    activeLocation,
    setActiveLocation,
    setActiveDayIdx,
    recalculateDayTimesAsync,
    token,
    handleSend,
    setInput,
    messages,
    setMessages,
    currentProposals, 
    setCurrentProposals
  } = usePlanner();

  const location = useLocation();
  const { uuid: itineraryUuidParam } = useParams();
  const hasAppliedPrefill = useRef(false);

  // ── 自動處理首頁傳來的 AI 請求 ──
  useEffect(() => {
    if (itineraryUuidParam || hasAppliedPrefill.current) return;
    const prefill = location?.state?.prefill;
    if (!prefill || !prefill.prompt) return;

    hasAppliedPrefill.current = true; 
    setInput(prefill.prompt); 

    if (prefill.autoSend) {
      setShowAiPanel(true); 
    }
  }, [location.pathname, location.search, itineraryUuidParam, setInput, setShowAiPanel]);

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

  /**
   * 🚀 核心邏輯：向 LLM 請求詳細行程內容
   */
  const expandPlanDetail = async (proposalData) => {
    setIsLoadingItinerary(true);
    const proposalTitle = proposalData.title || proposalData.summary || "選定方案";
    
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          messages: [
            ...messages, 
            { role: 'user', content: `我選定了方案：【${proposalTitle}】。請為這個方案生成完整的詳細行程數據。包含每一天的具體項目(items)、座標、時間區間以及預算估算。請直接呼叫 update_itinerary 工具。` }
          ],
          currentPlan: null // 重建新行程不帶舊背景
        })
      });
      
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'AI 擴充行程失敗');

      if (data.plan) {
        // 重算時間與座標邏輯 (同步 Provider 的處理方式)
        const nextPlan = { ...data.plan };
        if (nextPlan.days) {
          nextPlan.days = await Promise.all(
            nextPlan.days.map(async (day) => {
              const validItems = (day.items || []).filter(i => i && i.name?.trim());
              const itemsWithTimes = await recalculateDayTimesAsync(validItems, day.startTime || '09:00');
              return { ...day, items: itemsWithTimes };
            })
          );
        }
        return nextPlan;
      }
      return null;
    } catch (e) {
      console.error("Expansion Error:", e);
      alert("AI 規劃詳細行程時發生錯誤，請稍後再試。");
      return null;
    } finally {
      setIsLoadingItinerary(false);
    }
  };

  return (
    <div className="az-root">
      {/* 載入中遮罩 (包含二次擴充時的狀態) */}
      {isLoadingItinerary && (
        <div className="az-loading-overlay">
          <div className="az-spinner" />
          <p>AI 正在編寫詳細行程，請稍候...</p>
        </div>
      )}

      {!isPublicMode && <NavigationSidebar />}

      <div className="az-main">
        <header className="az-topbar">
          <button className="az-topbar-icon-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>

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
            {!isPublicMode && (isAutoSaving || isSaving) && <span className="az-status-text">保存中...</span>}
            {saveMsg && (
              <span className={`az-save-msg ${saveMsg === '已保存' ? 'az-save-msg--ok' : 'az-save-msg--err'}`}>
                {saveMsg}
              </span>
            )}
          </div>

          <div className="az-topbar-spacer" />
        </header>

        <div className="az-content-wrap">
          <div className="az-trip-panel">
            {currentProposals && currentProposals.length > 0 ? (
              <ProposalPreviewer 
                proposals={currentProposals}
                onCancel={() => setCurrentProposals(null)}
                onPreview={async (data) => {
                  // 🚀 如果是預位符或資料太少，立即去問 LLM 詳細行程
                  if (data.isPlaceholder || !data.days || data.days.length === 0) {
                    const detailed = await expandPlanDetail(data);
                    if (detailed) setPlan(detailed);
                  } else {
                    setPlan(data);
                  }
                }}
                onConfirm={async (data) => {
                  // 🚀 選定時無論如何都重新請求最詳細的版本
                  const detailed = await expandPlanDetail(data);
                  if (detailed) {
                    setPlan(detailed);
                    setCurrentProposals(null);
                    setActiveTab('itinerary');
                  }
                }}
              />
            ) : (
              <>
                <TripHeroHeader isReadOnly={isPublicMode} />
                <div className="az-tabs">
                  <button className={`az-tab ${activeTab === 'info' ? 'az-tab--active' : ''}`} onClick={() => setActiveTab('info')}>資訊</button>
                  <button className={`az-tab ${activeTab === 'itinerary' ? 'az-tab--active' : ''}`} onClick={() => setActiveTab('itinerary')}>行程</button>
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
              </>
            )}
          </div>

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

      {!isPublicMode && showAiPanel && <AiAssistantPanel />}
    </div>
  );
};

const PlannerPage = ({ isPublicMode = false }) => {
  return (
    <PlannerProvider isPublicMode={isPublicMode}>
      <PlannerContent isPublicMode={isPublicMode} />
    </PlannerProvider>
  );
};

export default PlannerPage;