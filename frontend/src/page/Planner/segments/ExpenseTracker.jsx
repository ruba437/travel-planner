import React, { useMemo, useEffect } from 'react';
import { usePlanner } from '../PlannerProvider';

const ExpenseTracker = ({ isReadOnly = false }) => {
  const { 
    plan, 
    totalBudget, 
    setTotalBudget,
    currencyConfig,
    displayCurrency,
    setDisplayCurrency
  } = usePlanner();

  // 1. 計算所有行程點的總支出 (當地貨幣)
  const totalCost = useMemo(() => {
    if (!plan || !plan.days) return 0;
    return plan.days.reduce((sum, day) => {
      const dayCost = (day.items || []).reduce((daySum, item) => {
        return daySum + (Number(item.cost) || 0);
      }, 0);
      return sum + dayCost;
    }, 0);
  }, [plan]);

  const isHomeView = displayCurrency === 'home';
  const currentSymbol = isHomeView ? currencyConfig.home : currencyConfig.local;
  const displayBudget = isHomeView
    ? totalBudget
    : currencyConfig.rate > 0
      ? totalBudget / currencyConfig.rate
      : 0;
  const displaySpent = isHomeView
    ? totalCost * currencyConfig.rate
    : totalCost;
  const remaining = displayBudget - displaySpent;
  const isOverBudget = remaining < 0;
  const progressPercent = totalBudget > 0 ? Math.min(100, ((totalCost * currencyConfig.rate) / totalBudget) * 100) : 0;

  const handleBudgetChange = (e) => {
    const value = Number(e.target.value);
    if (isHomeView) {
      setTotalBudget(value);
    } else {
      setTotalBudget(value * currencyConfig.rate);
    }
  };

  // 防呆：當地貨幣與母國貨幣相同時，自動切換到母國貨幣顯示模式
  useEffect(() => {
    if (currencyConfig.local === currencyConfig.home) {
      setDisplayCurrency('home');
    }
  }, [currencyConfig.local, currencyConfig.home, setDisplayCurrency]);

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
        <div className="az-budget-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span>總預算 ({currentSymbol})</span>
          <input 
            type="number" 
            className="az-budget-input" 
            value={Math.round(displayBudget)} 
            onChange={handleBudgetChange}
            step={isHomeView ? 1000 : Math.round(1000 / (currencyConfig.rate || 1))}
            placeholder="設定預算..."
            disabled={isReadOnly}
          />
        </div>

        {/* 幣值顯示切換 */}
        {currencyConfig.local !== currencyConfig.home && (
          <div className="az-budget-currency-switch" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0' }}>
            <button
              type="button"
              className={displayCurrency === 'local' ? 'az-pill az-pill-active' : 'az-pill'}
              onClick={() => setDisplayCurrency('local')}
            >
              當地貨幣
            </button>
            <button
              type="button"
              className={displayCurrency === 'home' ? 'az-pill az-pill-active' : 'az-pill'}
              onClick={() => setDisplayCurrency('home')}
            >
              台幣(母國貨幣)
            </button>
          </div>
        )}

        <div className="az-budget-display" style={{ marginBottom: '12px', fontSize: '1.1rem', fontWeight: 600, color: '#111' }}>
          {`${currentSymbol} ${Math.round(displaySpent).toLocaleString()}`}
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
        <div className="az-budget-stats" style={{ display: 'grid', gap: '6px' }}>
          <div className="az-expense-primary" style={{ color: isOverBudget ? '#ef4444' : '#6b7280' }}>
            已支出 {currentSymbol} {Math.round(displaySpent).toLocaleString()}
          </div>
          <div className={isOverBudget ? 'az-over' : 'az-under'}>
            剩餘 {currentSymbol} {Math.round(remaining).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseTracker;