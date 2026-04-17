import React, { useEffect, useRef, useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { usePlanner } from '../PlannerProvider';

// 類別對應圖示與顏色 (從原 App.jsx 搬移)
const TYPE_ICON = { sight: '🗺️', food: '🍜', shopping: '🛍️', activity: '🎯', hotel: '🏨', transport: '🚌' };
const TYPE_COLOR = { sight: '#0ea5e9', food: '#f97316', shopping: '#ec4899', activity: '#10b981', hotel: '#7c3aed', transport: '#6b7280' };
const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const PHOTO_REF_CACHE = new Map();

const getPhotoUrl = (photoReference) => {
  if (!photoReference) return null;
  return `${API_BASE}/api/places/photo?ref=${encodeURIComponent(photoReference)}&maxwidth=240`;
};

const ActivityItemCard = ({
  item,
  index,
  dayIdx,
  isReadOnly = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMovePrevDay,
  onMoveNextDay,
  canMoveUp,
  canMoveDown,
  canMovePrevDay,
  canMoveNextDay,
}) => {
  const { activeLocation, setActiveLocation, plan, token } = usePlanner();
  const [menuOpen, setMenuOpen] = useState(false);
  const [failedPhotoReference, setFailedPhotoReference] = useState(null);
  const [searchedPhotoReference, setSearchedPhotoReference] = useState(null);
  const menuRef = useRef(null);
  const attemptedLookupRef = useRef(new Set());

  const isActive = activeLocation && 
                   Number(activeLocation.day) === (dayIdx + 1) && 
                   Number(activeLocation.order) === index;
  
  const iconColor = TYPE_COLOR[item.type] || '#6b7280';
  const typeLabel = { sight: '景點', food: '美食', shopping: '購物', activity: '活動', hotel: '住宿', transport: '交通' }[item.type] || item.type;
  const itemName = String(item.name || '').trim();
  const cityName = String(plan?.city || '').trim();
  const lookupKey = item.placeId
    ? `pid:${item.placeId}`
    : `${cityName}::${itemName}`;
  const cachedPhotoReference = PHOTO_REF_CACHE.get(lookupKey) || null;
  const photoReference = searchedPhotoReference || cachedPhotoReference || item.photoReference || null;
  const photoUrl = photoReference && failedPhotoReference !== photoReference
    ? getPhotoUrl(photoReference)
    : null;
  const shouldShowPhoto = Boolean(photoUrl);

  useEffect(() => {
    const canLookupByPlaceId = Boolean(item.placeId && token);
    const canLookupBySearch = Boolean(itemName && cityName && token);
    if (!canLookupByPlaceId && !canLookupBySearch) return;
    if (PHOTO_REF_CACHE.has(lookupKey)) return;
    if (attemptedLookupRef.current.has(lookupKey)) return;

    attemptedLookupRef.current.add(lookupKey);
    const controller = new AbortController();

    const resolvePhotoReference = async () => {
      try {
        let nextPhotoReference = null;

        if (item.placeId) {
          const detailRes = await fetch(
            `${API_BASE}/api/places/details?placeId=${encodeURIComponent(item.placeId)}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            },
          );

          if (detailRes.ok) {
            const detailData = await detailRes.json();
            nextPhotoReference = detailData?.photos?.[0]?.photo_reference || null;
          }
        }

        if (!nextPhotoReference && itemName && cityName) {
          const searchRes = await fetch(`${API_BASE}/api/places/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ query: itemName, city: cityName }),
            signal: controller.signal,
          });

          if (!searchRes.ok) return;
          const searchData = await searchRes.json();
          const firstPlace = searchData?.places?.[0];
          if (!firstPlace) return;

          if (firstPlace.placeId) {
            const detailRes = await fetch(
              `${API_BASE}/api/places/details?placeId=${encodeURIComponent(firstPlace.placeId)}`,
              {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
              },
            );

            if (detailRes.ok) {
              const detailData = await detailRes.json();
              nextPhotoReference = detailData?.photos?.[0]?.photo_reference || null;
            }
          }

          if (!nextPhotoReference) {
            nextPhotoReference = firstPlace.photoReference || null;
          }
        }

        if (!nextPhotoReference || controller.signal.aborted) return;
        PHOTO_REF_CACHE.set(lookupKey, nextPhotoReference);
        setSearchedPhotoReference(nextPhotoReference);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.warn('Resolve place photo failed:', error);
        }
      }
    };

    resolvePhotoReference();
    return () => controller.abort();
  }, [item.placeId, itemName, cityName, token, lookupKey]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onDocClick = (event) => {
      if (!menuRef.current || menuRef.current.contains(event.target)) return;
      setMenuOpen(false);
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const [startTime, endTime] = String(item.time || '').split('~');
  const timeLabel = startTime && endTime
    ? `${String(startTime).trim()} - ${String(endTime).trim()}`
    : item.time;

  return (
    <Draggable draggableId={`item-${dayIdx}-${index}-${item.name}`} index={index} isDragDisabled={isReadOnly}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`az-timeline-item-wrap ${isActive ? 'az-timeline-item-wrap--active' : ''}`}
          onClick={() => setActiveLocation({ day: dayIdx + 1, order: index })}
          style={provided.draggableProps.style}
        >
          <div className="az-timeline-node" aria-hidden="true">
            {index + 1}
          </div>

          <div className="az-item-card-holder">
            <div
              className={`az-item-card ${snapshot.isDragging ? 'az-item-card--dragging' : ''}`}
              {...provided.dragHandleProps}
            >
              <div className="az-item-thumb" style={shouldShowPhoto ? undefined : { background: `${iconColor}18`, color: iconColor }}>
                {shouldShowPhoto ? (
                  <img
                    className="az-item-thumb-img"
                    src={photoUrl}
                    alt={item.name || '景點圖片'}
                    loading="lazy"
                    onError={() => setFailedPhotoReference(photoReference)}
                  />
                ) : (TYPE_ICON[item.type] || '📍')}
              </div>

              <div className="az-item-body">
                {timeLabel && <div className="az-item-time-range">{timeLabel}</div>}
                <div className="az-item-name">{item.name}</div>
                {item.note && <div className="az-item-note">{item.note}</div>}
              </div>

              <div className="az-item-right" ref={menuRef}>
                <span className="az-item-type-badge" style={{ background: `${iconColor}18`, color: iconColor }}>
                  {typeLabel}
                </span>
                {item.cost > 0 && (
                  <span className="az-item-cost">${Number(item.cost).toLocaleString()}</span>
                )}

                {!isReadOnly && (
                  <>
                    <button
                      type="button"
                      className="az-item-menu-trigger"
                      aria-label="更多操作"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuOpen((prev) => !prev);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>

                    {menuOpen && (
                      <div className="az-item-menu" onClick={(event) => event.stopPropagation()}>
                        <button type="button" className="az-item-menu-btn" onClick={() => { setMenuOpen(false); onEdit?.(); }}>編輯項目</button>
                        <button type="button" className="az-item-menu-btn" onClick={() => { setMenuOpen(false); onDelete?.(); }}>刪除項目</button>
                        <button type="button" className="az-item-menu-btn" disabled={!canMoveUp} onClick={() => { setMenuOpen(false); onMoveUp?.(); }}>同日上移</button>
                        <button type="button" className="az-item-menu-btn" disabled={!canMoveDown} onClick={() => { setMenuOpen(false); onMoveDown?.(); }}>同日下移</button>
                        <button type="button" className="az-item-menu-btn" disabled={!canMovePrevDay} onClick={() => { setMenuOpen(false); onMovePrevDay?.(); }}>移到前一天</button>
                        <button type="button" className="az-item-menu-btn" disabled={!canMoveNextDay} onClick={() => { setMenuOpen(false); onMoveNextDay?.(); }}>移到後一天</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default ActivityItemCard;