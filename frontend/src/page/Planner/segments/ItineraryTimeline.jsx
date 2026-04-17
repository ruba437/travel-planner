import React, { useMemo } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { usePlanner } from '../PlannerProvider';
import ActivityItemCard from './ActivityItemCard';
import TransportSegmentCard from './TransportSegmentCard';

const normalizeCoordPart = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'na';
  return num.toFixed(5);
};

const normalizeTextPart = (value) => String(value || '').trim().toLowerCase();

const buildSegmentId = (dayIdx, from, to) => {
  const fromLat = from?.location?.lat ?? from?.lat;
  const fromLng = from?.location?.lng ?? from?.lng;
  const toLat = to?.location?.lat ?? to?.lat;
  const toLng = to?.location?.lng ?? to?.lng;
  const fromKey = `loc:${normalizeCoordPart(fromLat)},${normalizeCoordPart(fromLng)}:${normalizeTextPart(from?.name)}`;
  const toKey = `loc:${normalizeCoordPart(toLat)},${normalizeCoordPart(toLng)}:${normalizeTextPart(to?.name)}`;
  return `seg-${Number(dayIdx) || 0}-${fromKey}-${toKey}`;
};

const ItineraryTimeline = ({ isReadOnly = false }) => {
  const { 
    plan, 
    setPlan, 
    activeDayIdx, 
    recalculateDayTimesAsync,
    optimizeDayRoute 
  } = usePlanner();

  const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm || '00:00').split(':').map(Number);
    return ((Number(h) || 0) * 60) + (Number(m) || 0);
  };

  const parseTimeRange = (timeRange) => {
    const [startRaw, endRaw] = String(timeRange || '').split('~');
    const start = (startRaw || '').trim();
    const end = (endRaw || '').trim();
    return { start, end };
  };

  const formatDistance = (a, b) => {
    const getPoint = (item) => {
      if (item?.location?.lat && item?.location?.lng) return item.location;
      if (item?.lat && item?.lng) return { lat: item.lat, lng: item.lng };
      return null;
    };

    const p1 = getPoint(a);
    const p2 = getPoint(b);
    if (!p1 || !p2) return null;

    const toRad = (v) => (Number(v) * Math.PI) / 180;
    const dLat = toRad(Number(p2.lat) - Number(p1.lat));
    const dLng = toRad(Number(p2.lng) - Number(p1.lng));
    const lat1 = toRad(p1.lat);
    const lat2 = toRad(p2.lat);
    const km = 6371 * 2 * Math.atan2(
      Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2),
      Math.sqrt(1 - (Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2)),
    );

    if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
    return `${km.toFixed(1)} km`;
  };

  const buildDirectionsUrl = (fromItem, toItem, mode = 'TRANSIT') => {
    const formatPoint = (item) => {
      if (item?.location?.lat && item?.location?.lng) {
        return `${item.location.lat},${item.location.lng}`;
      }
      if (item?.lat && item?.lng) {
        return `${item.lat},${item.lng}`;
      }
      return encodeURIComponent(item?.name || '');
    };

    const origin = formatPoint(fromItem);
    const destination = formatPoint(toItem);
    const modeMap = {
      TRANSIT: 'transit',
      DRIVING: 'driving',
      WALKING: 'walking',
      BICYCLING: 'bicycling',
    };
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${modeMap[mode] || 'transit'}`;
  };

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

  const recalcAndSetDayItems = async (dayIndex, nextItems) => {
    if (!plan) return;
    const nextPlan = { ...plan, days: [...plan.days] };
    const mode = nextPlan.days[dayIndex].transportMode || 'TRANSIT';
    const startTime = nextPlan.days[dayIndex].startTime;
    nextPlan.days[dayIndex] = {
      ...nextPlan.days[dayIndex],
      items: await recalculateDayTimesAsync(nextItems, startTime, mode),
    };
    setPlan(nextPlan);
  };

  const handleEditActivity = async (index) => {
    const current = plan?.days?.[activeDayIdx]?.items?.[index];
    if (!current) return;

    const name = prompt('編輯地點名稱：', current.name || '');
    if (name === null) return;

    const note = prompt('編輯描述（可留空）：', current.note || '');
    if (note === null) return;

    const costText = prompt('編輯費用（數字）：', String(current.cost || 0));
    if (costText === null) return;
    const cost = Number(costText);

    const dayItems = [...(plan.days[activeDayIdx].items || [])];
    dayItems[index] = {
      ...dayItems[index],
      name: name.trim() || dayItems[index].name,
      note: note.trim(),
      cost: Number.isFinite(cost) && cost >= 0 ? cost : 0,
    };
    await recalcAndSetDayItems(activeDayIdx, dayItems);
  };

  const handleDeleteActivity = async (index) => {
    if (!plan) return;
    const ok = window.confirm('確定要刪除這個行程項目嗎？');
    if (!ok) return;

    const dayItems = [...(plan.days[activeDayIdx].items || [])];
    dayItems.splice(index, 1);
    await recalcAndSetDayItems(activeDayIdx, dayItems);
  };

  const handleMoveWithinDay = async (index, direction) => {
    if (!plan) return;
    const dayItems = [...(plan.days[activeDayIdx].items || [])];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= dayItems.length) return;

    const [moved] = dayItems.splice(index, 1);
    dayItems.splice(targetIndex, 0, moved);
    await recalcAndSetDayItems(activeDayIdx, dayItems);
  };

  const handleMoveToAdjacentDay = async (index, offset) => {
    if (!plan) return;
    const targetDayIdx = activeDayIdx + offset;
    if (targetDayIdx < 0 || targetDayIdx >= plan.days.length) return;

    const nextPlan = { ...plan, days: [...plan.days] };
    const sourceItems = [...(nextPlan.days[activeDayIdx].items || [])];
    const targetItems = [...(nextPlan.days[targetDayIdx].items || [])];
    const [movedItem] = sourceItems.splice(index, 1);
    if (!movedItem) return;
    targetItems.push(movedItem);

    const sourceMode = nextPlan.days[activeDayIdx].transportMode || 'TRANSIT';
    const targetMode = nextPlan.days[targetDayIdx].transportMode || 'TRANSIT';
    const sourceStart = nextPlan.days[activeDayIdx].startTime;
    const targetStart = nextPlan.days[targetDayIdx].startTime;

    nextPlan.days[activeDayIdx] = {
      ...nextPlan.days[activeDayIdx],
      items: await recalculateDayTimesAsync(sourceItems, sourceStart, sourceMode),
    };
    nextPlan.days[targetDayIdx] = {
      ...nextPlan.days[targetDayIdx],
      items: await recalculateDayTimesAsync(targetItems, targetStart, targetMode),
    };

    setPlan(nextPlan);
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

  const hasDays = Boolean(plan?.days?.length);
  const currentDay = hasDays
    ? (plan.days[activeDayIdx] || { items: [], transportMode: 'TRANSIT' })
    : { items: [], transportMode: 'TRANSIT' };
  const currentMode = currentDay.transportMode || 'TRANSIT';

  const segments = useMemo(() => {
    const items = currentDay.items || [];
    return items.slice(0, -1).map((item, idx) => {
      const next = items[idx + 1];
      const prevEnd = parseTimeRange(item.time).end;
      const nextStart = parseTimeRange(next.time).start;
      const minutes = Math.max(0, toMinutes(nextStart) - toMinutes(prevEnd));

      return {
        id: buildSegmentId(activeDayIdx, item, next),
        durationText: minutes > 0 ? `${minutes} min` : '15 min',
        distanceText: formatDistance(item, next),
        mode: currentMode,
        directionsUrl: buildDirectionsUrl(item, next, currentMode),
      };
    });
  }, [activeDayIdx, currentDay.items, currentMode]);

  if (!hasDays) return null;

  return (
    <DragDropContext onDragEnd={isReadOnly ? undefined : onDragEnd}>
      <div className="az-day-block">
        <div className="az-day-timeline-head">
          <h3 className="az-day-timeline-title">Day {activeDayIdx + 1}</h3>
        </div>
        
        {/* === 單日交通方式選單 === */}
        {!isReadOnly && (
          <div className="az-daily-transport-selector">
            <span className="az-daily-transport-label">🚗 本日交通方式：</span>
            <select 
              value={currentMode}
              onChange={(e) => handleDailyTravelModeChange(e.target.value)}
              className="az-daily-transport-select"
            >
              <option value="TRANSIT">🚇 大眾運輸</option>
              <option value="DRIVING">🚗 開車包車</option>
              <option value="WALKING">🚶 徒步漫遊</option>
              <option value="BICYCLING">🚲 單車騎行</option>
            </select>

            {/* 自動排序按鈕 */}
            <button
              onClick={() => optimizeDayRoute(activeDayIdx)}
              className="az-sort-route-btn"
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
              {currentDay.items?.map((item, idx) => {
                const segment = segments[idx];
                return (
                  <React.Fragment key={`item-frag-${activeDayIdx}-${idx}`}>
                    <ActivityItemCard
                      key={`item-${activeDayIdx}-${idx}`}
                      item={item}
                      index={idx}
                      dayIdx={activeDayIdx}
                      isReadOnly={isReadOnly}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < (currentDay.items?.length || 0) - 1}
                      canMovePrevDay={activeDayIdx > 0}
                      canMoveNextDay={activeDayIdx < plan.days.length - 1}
                      onEdit={() => handleEditActivity(idx)}
                      onDelete={() => handleDeleteActivity(idx)}
                      onMoveUp={() => handleMoveWithinDay(idx, -1)}
                      onMoveDown={() => handleMoveWithinDay(idx, 1)}
                      onMovePrevDay={() => handleMoveToAdjacentDay(idx, -1)}
                      onMoveNextDay={() => handleMoveToAdjacentDay(idx, 1)}
                    />
                    {idx < (currentDay.items?.length || 0) - 1 && segment && (
                      <TransportSegmentCard
                        id={segment.id}
                        mode={segment.mode}
                        durationText={segment.durationText}
                        distanceText={segment.distanceText}
                        directionsUrl={segment.directionsUrl}
                      />
                    )}
                  </React.Fragment>
                );
              })}
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