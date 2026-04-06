import React, { useMemo } from 'react';
import { usePlanner } from '../PlannerProvider';

const ExpenseTracker = () => {
  const { 
    plan, 
    totalBudget, 
    setTotalBudget 
  } = usePlanner();

  // 1. 計算所有行程點的總支出 (使用 useMemo 效能優化)
  const totalSpent = useMemo(() => {
    if (!plan || !plan.days) return 0;
    return plan.days.reduce((sum, day) => {
      const dayCost = (day.items || []).reduce((daySum, item) => {
        return daySum + (Number(item.cost) || 0);
      }, 0);
      return sum + dayCost;
    }, 0);
  }, [plan]);

  // 2. 計算剩餘預算
  const remaining = totalBudget - totalSpent;
  const isOverBudget = remaining < 0;

  // 3. 計算進度條百分比
  const progressPercent = totalBudget > 0 
    ? Math.min((totalSpent / totalBudget) * 100, 100) 
    : 0;

  // 處理預算輸入變更
  const handleBudgetChange = (e) => {
    const value = Number(e.target.value);
    setTotalBudget(value >= 0 ? value : 0);
  };

  if (!plan) return null;

  return (
    <div className="az-section az-budget-section">
      <div className="az-section-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <span>預算追蹤</span>
      </div>

      <div className="az-budget-body">
        {/* 預算設定區 */}
        <div className="az-budget-row">
          <span>總預算 (TWD)</span>
          <input 
            type="number" 
            className="az-budget-input" 
            value={totalBudget} 
            onChange={handleBudgetChange}
            placeholder="設定預算..."
          />
        </div>

        {/* 視覺化進度條 */}
        <div className="az-budget-bar-wrap">
          <div 
            className="az-budget-bar" 
            style={{ 
              width: `${progressPercent}%`, 
              background: isOverBudget ? '#ef4444' : '#10b981' 
            }} 
          />
        </div>

        {/* 數據統計區 */}
        <div className="az-budget-stats">
          <span style={{ color: isOverBudget ? '#ef4444' : '#6b7280' }}>
            已支出 ${totalSpent.toLocaleString()}
          </span>
          <span className={isOverBudget ? 'az-over' : 'az-under'}>
            {remaining >= 0 
              ? `剩餘 $${remaining.toLocaleString()}` 
              : `超額 $${Math.abs(remaining).toLocaleString()}`
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default ExpenseTracker;