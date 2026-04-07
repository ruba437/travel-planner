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
    token 
  } = usePlanner();

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

    // 更新資料並重新計算時間
    if (sourceDayIdx === destDayIdx) {
      newPlan.days[sourceDayIdx].items = await recalculateDayTimesAsync(
        sourceItems, 
        newPlan.days[sourceDayIdx].startTime, 
        token
      );
    } else {
      newPlan.days[sourceDayIdx].items = await recalculateDayTimesAsync(
        sourceItems, 
        newPlan.days[sourceDayIdx].startTime, 
        token
      );
      newPlan.days[destDayIdx].items = await recalculateDayTimesAsync(
        destItems, 
        newPlan.days[destDayIdx].startTime, 
        token
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
    dayItems.push({ name, type: 'sight', time: '', cost: 0 });

    recalculateDayTimesAsync(dayItems, plan.days[activeDayIdx].startTime, token)
      .then(updatedItems => {
        newPlan.days[activeDayIdx] = { ...plan.days[activeDayIdx], items: updatedItems };
        setPlan({ ...newPlan });
      });
  };

  if (!plan?.days || plan.days.length === 0) return null;

  const currentDay = plan.days[activeDayIdx];

  return (
    <DragDropContext onDragEnd={isReadOnly ? undefined : onDragEnd}>
      <div className="az-day-block">
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