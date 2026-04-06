import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { usePlanner } from '../PlannerProvider';

// 類別對應圖示與顏色 (從原 App.jsx 搬移)
const TYPE_ICON = { sight: '🗺️', food: '🍜', shopping: '🛍️', activity: '🎯', hotel: '🏨', transport: '🚌' };
const TYPE_COLOR = { sight: '#0ea5e9', food: '#f97316', shopping: '#ec4899', activity: '#10b981', hotel: '#7c3aed', transport: '#6b7280' };

const ActivityItemCard = ({ item, index, dayIdx }) => {
  const { activeLocation, setActiveLocation } = usePlanner();

  const isActive = activeLocation && 
                   Number(activeLocation.day) === (dayIdx + 1) && 
                   Number(activeLocation.order) === index;
  
  const iconColor = TYPE_COLOR[item.type] || '#6b7280';
  const typeLabel = { sight: '景點', food: '美食', shopping: '購物', activity: '活動', hotel: '住宿', transport: '交通' }[item.type] || item.type;

  return (
    <Draggable draggableId={`item-${dayIdx}-${index}-${item.name}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`az-item-card ${isActive ? 'az-item-card--active' : ''} ${snapshot.isDragging ? 'az-item-card--dragging' : ''}`}
          onClick={() => setActiveLocation({ day: dayIdx + 1, order: index })}
          style={provided.draggableProps.style}
        >
          <div className="az-item-icon" style={{ background: `${iconColor}18`, color: iconColor }}>
            {TYPE_ICON[item.type] || '📍'}
          </div>
          
          <div className="az-item-body">
            <div className="az-item-name">{item.name}</div>
            {item.time && (
              <div className="az-item-time">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
                </svg>
                {item.time}
              </div>
            )}
          </div>

          <div className="az-item-right">
            <span className="az-item-type-badge" style={{ background: `${iconColor}18`, color: iconColor }}>
              {typeLabel}
            </span>
            {item.cost > 0 && (
              <span className="az-item-cost">${Number(item.cost).toLocaleString()}</span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default ActivityItemCard;