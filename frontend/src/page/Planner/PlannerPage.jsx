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

const buildPhotoUrl = (photoReference) => {
  if (!photoReference) return null;
  return `${API_BASE}/api/places/photo?ref=${encodeURIComponent(photoReference)}&maxwidth=400`;
};

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
    activeDayIdx,
    setActiveDayIdx,
    recalculateDayTimesAsync,
    updateGlobalStartLocation,
    updateDayStartLocation,
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
  }, [location.pathname, location.search, itineraryUuidParam, location?.state?.prefill, setInput, setShowAiPanel]);

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
      imageUrl: locationData.imageUrl || buildPhotoUrl(locationData.photoReference) || null,
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

  const handleSetStartLocation = (locationData) => {
    if (!plan || !Array.isArray(plan.days)) return;
    if (!Number.isInteger(locationData?.targetDayIndex)) return;

    updateDayStartLocation(locationData.targetDayIndex, locationData.name);
    setActiveDayIdx(locationData.targetDayIndex);
  };

  const handleSetGlobalStartLocation = (locationData) => {
    updateGlobalStartLocation(locationData?.name || '');
  };
  
  /**
   * 🚀 核心邏輯：向 LLM 請求詳細行程內容
   */
  const expandPlanDetail = async (proposalData) => {
    setIsLoadingItinerary(true);
    const baseProposal = proposalData?.itineraryData || proposalData || {};
    const proposalTitle = proposalData?.title || baseProposal.summary || "選定方案";
    
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
            {
              role: 'user',
              content: `我選定了方案：【${proposalTitle}】。請生成完整詳細行程。⚠️要求：每日地點禁止重複，同點活動請合併。`
            }
          ],
          currentPlan: null 
        })
      });
      
      const data = await res.json();
      if (data.plan) {
        const nextPlan = { ...data.plan };
        if (nextPlan.days) {
          nextPlan.days = await Promise.all(
            nextPlan.days.map(async (day) => {
              // 🛡️ 實作 Set 去重
              const seenNames = new Set();
              const uniqueItems = (day.items || []).filter(item => {
                const name = item.name?.trim();
                if (name && !seenNames.has(name)) {
                  seenNames.add(name);
                  return true;
                }
                return false;
              });

              // 重新計算時間軸
              const itemsWithTimes = await recalculateDayTimesAsync(uniqueItems, day.startTime || '09:00');
              return { ...day, items: itemsWithTimes };
            })
          );
        }
        return nextPlan;
      }
    } catch (e) {
      console.error("Expansion Error:", e);
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
                onConfirm={async (proposal) => {
                  // 這裡的 proposal 就是 AI 傳回的單個方案物件
                  // 執行之前寫好的 expandPlanDetail，讓 AI 產生詳細 JSON
                  const detailed = await expandPlanDetail(proposal); 
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
              activeDayIdx={activeDayIdx}
              onDayChange={setActiveDayIdx}
              activeLocation={activeLocation}
              onLocationChange={setActiveLocation}
              onAddLocation={isPublicMode ? null : handleAddLocation}
              onSetStartLocation={isPublicMode ? null : handleSetStartLocation}
              onSetGlobalStartLocation={isPublicMode ? null : handleSetGlobalStartLocation}
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