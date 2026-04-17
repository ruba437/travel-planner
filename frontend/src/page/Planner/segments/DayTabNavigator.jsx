import React from 'react';
import { usePlanner } from '../PlannerProvider';

const WEEKDAYS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

const DayTabNavigator = ({ isReadOnly = false }) => {
  const { 
    plan, 
    activeDayIdx, 
    setActiveDayIdx, 
    weatherData 
  } = usePlanner();

  // 取得每一天的標籤資訊 (日期、星期)
  const getDayLabel = (startDate, dayIndex) => {
    if (!startDate) return { date: `第${dayIndex + 1}天`, weekday: '' };
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayIndex);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const wd = WEEKDAYS_ZH[date.getDay()];
    return { date: `${m}月${d}日`, weekday: wd };
  };

  // 取得當天的天氣圖示與氣溫
  const getWeatherForDay = (dayIndex) => {
    if (!weatherData || !weatherData.time) return null;
    
    // 天氣代碼轉圖示邏輯 (從原 App.jsx 搬移)
    const getWeatherIcon = (code) => {
      if (code === undefined || code === null) return null;
      if (code <= 1) return '☀️';
      if (code <= 3) return '⛅';
      if (code <= 48) return '🌫️';
      if (code <= 67) return '🌧️';
      if (code <= 77) return '❄️';
      if (code <= 82) return '🌧️';
      if (code <= 86) return '❄️';
      if (code <= 99) return '⛈️';
      return '🌡️';
    };

    const code = weatherData.weathercode[dayIndex];
    const maxT = weatherData.temperature_2m_max[dayIndex];
    const minT = weatherData.temperature_2m_min[dayIndex];
    
    if (code === undefined || maxT === undefined) return null;
    return { icon: getWeatherIcon(code), max: maxT, min: minT };
  };

  if (!plan?.days || plan.days.length === 0) return null;

  return (
    <div className="az-day-tabs-container">
      <div className="az-day-tabs">
        {plan.days.map((day, idx) => {
          const lbl = getDayLabel(plan.startDate, idx);
          const weather = getWeatherForDay(idx);
          
          return (
            <button
              key={idx}
              className={`az-day-tab ${activeDayIdx === idx ? 'az-day-tab--active' : ''}`}
              onClick={() => setActiveDayIdx(idx)}
            >
              <span className="az-day-tab-date">{lbl.date}</span>
              <span className="az-day-tab-num">第 {idx + 1} 天</span>
              {weather && (
                <span className="az-day-tab-weather" title={`${weather.min}° - ${weather.max}°`}>
                  {weather.icon}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DayTabNavigator;