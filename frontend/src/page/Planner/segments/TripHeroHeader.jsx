import React, { useState } from 'react';
import { usePlanner } from '../PlannerProvider';

const TripHeroHeader = () => {
  const { 
    plan, 
    setPlan, 
    recalculateDayTimesAsync,
    token 
  } = usePlanner();

  // 內部編輯狀態 (原 App.jsx 內的 hero edit 邏輯)
  const [isEditingHero, setIsEditingHero] = useState(false);
  const [tripNameInput, setTripNameInput] = useState('');
  const [tripStartDateInput, setTripStartDateInput] = useState('');
  const [tripStartTimeInput, setTripStartTimeInput] = useState('09:00');

  // 常數與輔助函數
  const DEFAULT_DAY_START_TIME = '09:00';
  const normalizeTimeValue = (value, fallback = DEFAULT_DAY_START_TIME) => {
    const raw = String(value || '').trim();
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return fallback;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return fallback;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  // 同步編輯器資料
  const syncHeroEditorFromPlan = () => {
    setTripNameInput((plan?.tripName || '').trim() || '');
    setTripStartDateInput(plan?.startDate || '');
    setTripStartTimeInput(normalizeTimeValue(plan?.startTime, DEFAULT_DAY_START_TIME));
  };

  const openHeroEditor = () => {
    syncHeroEditorFromPlan();
    setIsEditingHero(true);
  };

  const handleHeroEditCancel = () => {
    setIsEditingHero(false);
  };

  const handleHeroEditSave = async () => {
    if (!plan) {
      setIsEditingHero(false);
      return;
    }
    const nextTripName = tripNameInput.trim();
    const nextStartDate = tripStartDateInput || null;
    const nextStartTime = normalizeTimeValue(tripStartTimeInput, DEFAULT_DAY_START_TIME);
    
    let nextDays = plan.days;
    
    // 如果有行程天數，重新計算時間
    if (Array.isArray(plan.days)) {
      nextDays = await Promise.all(
        plan.days.map(async (day) => {
          const dayStartTime = day.startTime || nextStartTime || '09:00';
          const recalculatedItems = await recalculateDayTimesAsync(day.items || [], dayStartTime, token);
          return { 
            ...day, 
            startTime: dayStartTime, 
            items: recalculatedItems 
          };
        })
      );
    }

    setPlan({
      ...plan,
      tripName: nextTripName,
      startDate: nextStartDate,
      startTime: nextStartTime,
      days: nextDays,
    });
    setIsEditingHero(false);
  };

  // 計算標題與日期範圍顯示
  const tripTitle = plan?.tripName?.trim() || (plan?.summary || plan?.city ? `${plan?.city || ''}之旅` : '新的旅程');
  
  const tripDateRange = plan?.startDate && plan?.days?.length
    ? (() => {
        const start = new Date(plan.startDate);
        const end = new Date(plan.startDate);
        end.setDate(end.getDate() + plan.days.length - 1);
        return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
      })()
    : '';

  return (
    <div className="az-hero">
      <div className="az-hero-overlay" />
      <img
        className="az-hero-img"
        src={`https://source.unsplash.com/800x240/?${encodeURIComponent(plan?.city || 'travel')},scenery`}
        alt="trip cover"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
      
      <div className="az-hero-content">
        <h1 className="az-hero-title">
          {tripTitle}
          <button className="az-hero-edit-btn" onClick={openHeroEditor} aria-label="編輯行程資訊">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </h1>

        {tripDateRange && (
          <div className="az-hero-date">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {tripDateRange}
            {plan?.startTime ? `・${normalizeTimeValue(plan.startTime)} 出發` : ''}
          </div>
        )}

        {isEditingHero && (
          <div className="az-hero-edit-panel">
            <div className="az-hero-edit-grid">
              <input
                className="az-hero-edit-input"
                type="text"
                value={tripNameInput}
                onChange={(e) => setTripNameInput(e.target.value)}
                placeholder="旅行名稱"
              />
              <input
                className="az-hero-edit-input"
                type="date"
                value={tripStartDateInput || ''}
                onChange={(e) => setTripStartDateInput(e.target.value)}
              />
              <input
                className="az-hero-edit-input"
                type="time"
                value={tripStartTimeInput}
                onChange={(e) => setTripStartTimeInput(e.target.value)}
              />
            </div>
            <div className="az-hero-edit-actions">
              <button className="az-hero-edit-action" onClick={handleHeroEditCancel}>取消</button>
              <button className="az-hero-edit-action az-hero-edit-action--primary" onClick={handleHeroEditSave}>儲存</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripHeroHeader;