import React, { useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { PlannerProvider, usePlanner, API_BASE } from './PlannerProvider'; 

// 匯入子區段
import NavigationSidebar from './segments/NavigationSidebar';
import TripHeroHeader from './segments/TripHeroHeader';
import DayTabNavigator from './segments/DayTabNavigator';
import ItineraryTimeline from './segments/ItineraryTimeline';
import PrepChecklist from './segments/PrepChecklist';
import ExpenseTracker from './segments/ExpenseTracker';
import AiAssistantPanel from './segments/AiAssistantPanel';
import ProposalPreviewer from './segments/ProposalPreviewer';

import MapView from '../../components/MapView';

import '../../styles/sidebar-shared.css';
import './PlannerStyles.css';

const buildPhotoUrl = (photoReference) => {
  if (!photoReference) return null;
  return `${API_BASE}/api/places/photo?ref=${encodeURIComponent(photoReference)}&maxwidth=400`;
};

const PlannerContent = ({ isPublicMode = false }) => {
  const { 
    activeTab, setActiveTab, sidebarCollapsed, setSidebarCollapsed,
    showAiPanel, setShowAiPanel, isSaving, isAutoSaving, hasUnsavedChanges, saveMsg,
    isLoadingItinerary, setIsLoadingItinerary, plan, setPlan,
    activeLocation, setActiveLocation, activeDayIdx, setActiveDayIdx,
    recalculateDayTimesAsync, updateGlobalStartLocation, updateDayStartLocation,
    token, setInput, messages, 
    currentProposals, setCurrentProposals
  } = usePlanner();

  const location = useLocation();
  const { uuid: itineraryUuidParam } = useParams();
  const hasAppliedPrefill = useRef(false);

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
   * 職責：將初步提案 (Proposal) 擴充為包含具體時間、地點與座標的完整行程
   */
  const expandPlanDetail = async (proposalData) => {
    setIsLoadingItinerary(true);
    
    // 1. 🛡️ 鎖定預期天數
    const expectedDays = 
      plan?.days?.length ||                              
      proposalData?.daySummaries?.length ||            
      (proposalData?.itineraryData?.days?.length) ||   
      0;
    
    if (expectedDays <= 0) {
      console.error("無法偵測旅遊天數", { plan, proposalData });
      alert("偵測不到行程天數，請嘗試重新整理頁面或重新對話。");
      setIsLoadingItinerary(false);
      return null;
    }

    // 2. 準備提案基礎資訊
    const baseProposal = proposalData?.itineraryData || proposalData || {};
    const proposalTitle = proposalData?.title || baseProposal.summary || "選定方案";
    
    try {
      // 🆕 提取方案中的每日大綱，用來強制約束 AI 每一天都要寫不同的內容
      const summariesText = (proposalData?.daySummaries || [])
        .map((desc, idx) => `第 ${idx + 1} 天核心主軸：${desc}`)
        .join('\n');

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
              content: [
                `我選定了方案：【${proposalTitle}】。`,
                `請根據以下這 ${expectedDays} 天的每日主軸，為我展開「每一天」的具體行程：`,
                `----------------`,
                summariesText || `請確保這 ${expectedDays} 天每天都有截然不同的行程。`,
                `----------------`,
                `⚠️【極度重要限制 - 嚴禁偷懶】：`,
                `1. 旅遊總天數必須「精確等於 ${expectedDays} 天」，請產出 Day 1 到 Day ${expectedDays} 完整的 JSON。`,
                `2. 每一天都必須安排 3~4 個「完全不同」的具體地點。`,
                `3. 全程「嚴禁重複任何地點」！絕對不可以把第一天的景點複製到第二天或第三天。`,
                `4. 必須使用「繁體中文」產出所有景點名稱、說明與概要。`,
                `請立刻呼叫 update_itinerary 工具產出結果。`
              ].join('\n')
            }
          ],
          // 🚀 傳入目前的 plan 背景，讓後端計算 expectedDays 並對齊天數
          currentPlan: { ...plan, days: plan?.days || new Array(expectedDays).fill({}) }
        })
      });
      
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'AI 擴充行程失敗');

      if (data.plan) {
        let nextPlan = { ...data.plan };
        
        // 3. 🛡️ 前端裁切保險：防止 AI 幻覺產生多餘天數
        if (nextPlan.days && nextPlan.days.length > expectedDays) {
          console.warn(`[Correction] AI generated extra days. Trimming to ${expectedDays}.`);
          nextPlan.days = nextPlan.days.slice(0, expectedDays);
        }

        // 4. 🛡️ 核心修復：全域跨天去重與順序編號
        if (nextPlan.days) {
          const globalSeenNames = new Set(); // 用來記錄跨天已經出現過的景點

          nextPlan.days = await Promise.all(
            nextPlan.days.map(async (day, dayIndex) => {
              day.day = dayIndex + 1; // 確保天數標號正確

              const uniqueItems = (day.items || []).filter(item => {
                const name = item.name?.trim();
                if (!name) return false;

                // 豁免清單：吃飯跟回飯店可以重複
                const genericKeywords = ['早餐', '午餐', '晚餐', '回飯店', '飯店', '休息', '自由活動'];
                const isGeneric = genericKeywords.some(k => name.includes(k));

                // 🚨 如果不是通用行程，且別天已經出現過，就無情剔除
                if (!isGeneric && globalSeenNames.has(name)) {
                  console.log(`[提案轉行程過濾] 移除跨天重複景點：${name}`);
                  return false;
                }
                
                if (!isGeneric) {
                  globalSeenNames.add(name);
                }
                return true;
              });

              // 重新計算交通時間，確保行程連續且符合 startTime
              const itemsWithTimes = await recalculateDayTimesAsync(
                uniqueItems, 
                day.startTime || '09:00'
              );
              
              // 💡 強制賦予正確的順序編號 (order)，讓紅色圓圈依序變成 1, 2, 3...
              const finalizedItems = itemsWithTimes.map((item, idx) => ({
                ...item,
                order: idx
              }));

              return { ...day, items: finalizedItems };
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