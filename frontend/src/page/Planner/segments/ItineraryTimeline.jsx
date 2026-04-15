import React from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { usePlanner } from '../PlannerProvider';
import ActivityItemCard from './ActivityItemCard';

const ItineraryTimeline = ({ isReadOnly = false }) => {
  const { 
    plan, 
    setPlan, 
    activeDayIdx, 
    recalculateDayTimesAsync,
    optimizeDayRoute 
  } = usePlanner();

  const handleDailyTravelModeChange = async (newMode) => {
    if (!plan) return;
    const newPlan = { ...plan };
    
    // 將選擇的交通方式存入該天資料中
    newPlan.days[activeDayIdx].transportMode = newMode;
    
    // 使用新的交通方式重新計算當天時間
    newPlan.days[activeDayIdx].items = await recalculateDayTimesAsync(
      newPlan.days[activeDayIdx].items, 
      newPlan.days[activeDayIdx].startTime, 
      newMode
    );
    
    setPlan(newPlan);
  };

  // 處理拖拽結束邏輯
  const onDragEnd = async (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newPlan = { ...plan };
    const sourceDayIdx = parseInt(source.droppableId.split('-')[1], 10);
    const destDayIdx = parseInt(destination.droppableId.split('-')[1], 10);
    
    const sourceItems = Array.from(newPlan.days[sourceDayIdx].items);
    const destItems = sourceDayIdx === destDayIdx ? sourceItems : Array.from(newPlan.days[destDayIdx].items);
    
    const [movedItem] = sourceItems.splice(source.index, 1);
    destItems.splice(destination.index, 0, movedItem);

    // 💡 取得當天的交通方式（若無則預設為 TRANSIT 大眾運輸）
    const sourceMode = newPlan.days[sourceDayIdx].transportMode || 'TRANSIT';
    const destMode = newPlan.days[destDayIdx].transportMode || 'TRANSIT';

    // 更新資料並重新計算時間（將原本的 token 改為 mode）
    if (sourceDayIdx === destDayIdx) {
      newPlan.days[sourceDayIdx].items = await recalculateDayTimesAsync(
        sourceItems, 
        newPlan.days[sourceDayIdx].startTime, 
        sourceMode
      );
    } else {
      newPlan.days[sourceDayIdx].items = await recalculateDayTimesAsync(
        sourceItems, 
        newPlan.days[sourceDayIdx].startTime, 
        sourceMode
      );
      newPlan.days[destDayIdx].items = await recalculateDayTimesAsync(
        destItems, 
        newPlan.days[destDayIdx].startTime, 
        destMode
      );
    }
    setPlan(newPlan);
  };

  // 手動新增項目
  const handleAddNewActivity = () => {
    const name = prompt('新增地點名稱：');
    if (!name || !plan) return;

    const newPlan = { ...plan };
    const dayItems = [...(plan.days[activeDayIdx].items || [])];
    const currentMode = plan.days[activeDayIdx].transportMode || 'TRANSIT';

    dayItems.push({ name, type: 'sight', time: '', cost: 0 });

    // 💡 將原本的 token 改為 currentMode
    recalculateDayTimesAsync(dayItems, plan.days[activeDayIdx].startTime, currentMode)
      .then(updatedItems => {
        newPlan.days[activeDayIdx] = { ...plan.days[activeDayIdx], items: updatedItems };
        setPlan({ ...newPlan });
      });
  };

  if (!plan?.days || plan.days.length === 0) return null;

  const currentDay = plan.days[activeDayIdx];
  const currentMode = currentDay.transportMode || 'TRANSIT';

  return (
    <DragDropContext onDragEnd={isReadOnly ? undefined : onDragEnd}>
      <div className="az-day-block">
        
        {/* === 新增：單日交通方式選單 === */}
        {!isReadOnly && (
          <div className="az-daily-transport-selector" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
            <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '500' }}>🚗 本日交通方式：</span>
            <select 
              value={currentMode}
              onChange={(e) => handleDailyTravelModeChange(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                color: '#374151',
                fontSize: '0.9rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="TRANSIT">🚇 大眾運輸</option>
              <option value="DRIVING">🚗 開車包車</option>
              <option value="WALKING">🚶 徒步漫遊</option>
              <option value="BICYCLING">🚲 單車騎行</option>
            </select>

            {/* 自動排序按鈕 */}
            <button
              onClick={() => optimizeDayRoute(activeDayIdx)}
              style={{
                marginLeft: 'auto', // 把按鈕推到最右邊
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                color: 'white',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 6px -1px rgba(59,130,246,0.3)',
                transition: 'transform 0.1s'
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title="固定第一站，將後續行程依直線距離自動順路排序"
            >
              ✨ 自動順路排序
            </button>
          </div>
        )}

        {/* 行程列表容器 */}
        <Droppable droppableId={`day-${activeDayIdx}`} isDragDisabled={isReadOnly}>
          {(provided, snapshot) => (
            <div
              className={`az-items-list ${snapshot.isDraggingOver ? 'az-items-list--over' : ''}`}
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {currentDay.items?.map((item, idx) => (
                <ActivityItemCard 
                  key={`item-${activeDayIdx}-${idx}`} 
                  item={item} 
                  index={idx} 
                  dayIdx={activeDayIdx}
                  isReadOnly={isReadOnly}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* 新增按鈕 - 只讀模式下隱藏 */}
        {!isReadOnly && (
          <button className="az-add-item-btn az-add-item-btn--day" onClick={handleAddNewActivity}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            新增項目
          </button>
        )}
      </div>
    </DragDropContext>
  );
};

export default ItineraryTimeline;