import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const isUnstableImageUrl = (url) => {
  const text = String(url || '').trim().toLowerCase();
  return text.includes('source.unsplash.com');
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
  const { activeLocation, setActiveLocation, plan, token, setPlan, currencyConfig, displayCurrency, updateItemCost } = usePlanner();
  const [menuOpen, setMenuOpen] = useState(false);
  const [failedImageState, setFailedImageState] = useState({ key: '', src: null });
  const [searchedPhotoReference, setSearchedPhotoReference] = useState(null);
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [localCost, setLocalCost] = useState(item.cost ? Number(item.cost) : '');
  const menuRef = useRef(null);
  const attemptedLookupRef = useRef(new Set());

  const isActive = activeLocation && 
                   Number(activeLocation.day) === (dayIdx + 1) && 
                   Number(activeLocation.order) === index;
  
  const iconColor = TYPE_COLOR[item.type] || '#6b7280';
  const typeLabel = { sight: '景點', food: '美食', shopping: '購物', activity: '活動', hotel: '住宿', transport: '交通' }[item.type] || item.type;
  const itemName = useMemo(() => String(item.name || '').trim(), [item.name]);
  const cityName = useMemo(() => String(plan?.city || '').trim(), [plan?.city]);
  const lookupKey = useMemo(() => {
    return item.placeId
      ? `pid:${item.placeId}`
      : `${cityName}::${itemName}`;
  }, [item.placeId, itemName, cityName]);
  const rawImageUrl = String(item.imageUrl || '').trim() || null;
  const directImageUrl = rawImageUrl && !isUnstableImageUrl(rawImageUrl) ? rawImageUrl : null;
  const cachedPhotoReference = PHOTO_REF_CACHE.get(lookupKey) || null;
  const imageIdentityKey = useMemo(() => (
    `${dayIdx}:${index}:${String(item.placeId || '')}:${String(item.photoReference || '')}:${String(item.imageUrl || '')}:${itemName}`
  ), [dayIdx, index, item.placeId, item.photoReference, item.imageUrl, itemName]);
  const failedImageSrc = failedImageState.key === imageIdentityKey ? failedImageState.src : null;
  const photoReference = searchedPhotoReference || cachedPhotoReference || item.photoReference || null;
  const fallbackPhotoUrl = photoReference
    ? getPhotoUrl(photoReference)
    : null;
  const photoUrl = [fallbackPhotoUrl, directImageUrl].find((candidate) => candidate && candidate !== failedImageSrc) || null;
  const shouldShowPhoto = Boolean(photoUrl);

  useEffect(() => {
    if (directImageUrl) return;
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
        let nextPlaceId = item.placeId || null;

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
            nextPlaceId = firstPlace.placeId;
          }

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
        const nextImageUrl = getPhotoUrl(nextPhotoReference);
        PHOTO_REF_CACHE.set(lookupKey, nextPhotoReference);
        setSearchedPhotoReference(nextPhotoReference);

        setPlan((prevPlan) => {
          if (!prevPlan || !Array.isArray(prevPlan.days)) return prevPlan;
          const targetDay = prevPlan.days?.[dayIdx];
          if (!targetDay || !Array.isArray(targetDay.items)) return prevPlan;
          const targetItem = targetDay.items?.[index];
          if (!targetItem) return prevPlan;

          const isSameItem =
            String(targetItem.name || '').trim() === itemName
            || (targetItem.placeId && targetItem.placeId === item.placeId);
          if (!isSameItem) return prevPlan;

          const currentPhotoReference = String(targetItem.photoReference || '').trim() || null;
          const currentImageUrl = String(targetItem.imageUrl || '').trim() || null;
          const currentPlaceId = String(targetItem.placeId || '').trim() || null;
          const resolvedPlaceId = String(nextPlaceId || '').trim() || currentPlaceId;

          if (
            currentPhotoReference === nextPhotoReference
            && currentImageUrl === nextImageUrl
            && currentPlaceId === resolvedPlaceId
          ) {
            return prevPlan;
          }

          const nextDays = [...prevPlan.days];
          const nextDay = { ...targetDay, items: [...targetDay.items] };
          nextDay.items[index] = {
            ...targetItem,
            photoReference: nextPhotoReference,
            imageUrl: nextImageUrl,
            placeId: resolvedPlaceId,
          };
          nextDays[dayIdx] = nextDay;
          return { ...prevPlan, days: nextDays };
        });
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.warn('Resolve place photo failed:', error);
        }
      }
    };

    resolvePhotoReference();
    return () => controller.abort();
  }, [directImageUrl, item.placeId, itemName, cityName, token, dayIdx, index, setPlan, lookupKey]);

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
                    onError={() => setFailedImageState({ key: imageIdentityKey, src: photoUrl })}
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
                <div
                  className="budget-edit-zone"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {isEditingCost ? (
                    <input
                      type="number"
                      autoFocus
                      value={localCost}
                      onChange={(e) => setLocalCost(e.target.value === '' ? '' : Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => {
                        updateItemCost(dayIdx, index, localCost === '' ? 0 : localCost);
                        setIsEditingCost(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateItemCost(dayIdx, index, localCost === '' ? 0 : localCost);
                          setIsEditingCost(false);
                        }
                      }}
                      style={{ width: '80px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #3b82f6', fontSize: '0.9rem' }}
                      placeholder="0"
                    />
                  ) : item.cost > 0 ? (
                    <span className="az-item-cost" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setIsEditingCost(true); }}>
                      {displayCurrency === 'local'
                        ? `${currencyConfig.local} ${Number(item.cost).toLocaleString()}`
                        : `${currencyConfig.home} ${Math.round(Number(item.cost) * currencyConfig.rate).toLocaleString()}`
                      }
                      <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>✏️</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIsEditingCost(true); }}
                      style={{ padding: '0.25rem 0.75rem', background: 'transparent', border: '1px solid #d1d5db', borderRadius: '4px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      + 新增預算
                    </button>
                  )}
                </div>

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