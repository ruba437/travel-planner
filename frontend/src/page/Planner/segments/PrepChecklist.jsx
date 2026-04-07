import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlanner, API_BASE } from '../PlannerProvider';

const CHECKLIST_LIMIT = 10;
const CHECKLIST_TEXT_MAX_LENGTH = 800;

const getChecklistSortOrder = (item, fallbackIndex = 0) => {
  const sortOrderValue = Number(item?.sortOrder);
  return Number.isFinite(sortOrderValue) ? Math.max(0, sortOrderValue) : fallbackIndex;
};

const sortChecklistItems = (items = []) => {
  return [...items].sort((a, b) => {
    const sortDiff = getChecklistSortOrder(a) - getChecklistSortOrder(b);
    if (sortDiff !== 0) return sortDiff;
    return String(a.id).localeCompare(String(b.id));
  });
};

const normalizeChecklistItems = (items = []) => {
  return sortChecklistItems(items).map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
};

const PrepChecklist = ({ isReadOnly = false }) => {
  const {
    packingItems,
    setPackingItems,
    itineraryUuid,
    token,
    saveItinerary,
    isChecklistSyncing,
    setIsChecklistSyncing,
    setSaveMsg,
  } = usePlanner();

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editingChecklistText, setEditingChecklistText] = useState('');
  const addInputRef = useRef(null);
  const editInputRef = useRef(null);

  const orderedPackingItems = useMemo(() => normalizeChecklistItems(packingItems), [packingItems]);

  useEffect(() => {
    if (isAddingItem && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAddingItem]);

  useEffect(() => {
    if (editingChecklistId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingChecklistId]);

  const setChecklistError = (message) => {
    setSaveMsg(message || '行前清單更新失敗');
    setTimeout(() => setSaveMsg(null), 2500);
  };

  const persistChecklistOrder = async (previousItems, nextItems) => {
    if (!itineraryUuid) return true;

    const previousById = new Map(previousItems.map((item) => [String(item.id), item]));
    const changedItems = nextItems.filter((item) => {
      if (String(item.id).startsWith('local-')) return false;
      const previousItem = previousById.get(String(item.id));
      return previousItem && previousItem.sortOrder !== item.sortOrder;
    });

    if (changedItems.length === 0) return true;

    try {
      for (const item of changedItems) {
        await requestChecklistApi(`/${encodeURIComponent(item.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ sortOrder: item.sortOrder }),
        });
      }
      return true;
    } catch (error) {
      const saved = await saveItinerary({ silent: true, packingItems: nextItems });
      if (saved) return true;
      throw error;
    }
  };

  const requestChecklistApi = async (path = '', options = {}) => {
    if (!itineraryUuid) throw new Error('請先儲存行程後再同步清單');
    if (!token) throw new Error('登入資訊尚未就緒，請稍後再試');
    const res = await fetch(`${API_BASE}/api/itineraries/${itineraryUuid}/checklist${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '行前清單同步失敗');
    return data;
  };

  const addChecklistItem = async () => {
    if (isReadOnly || isChecklistSyncing) return;

    const text = newChecklistText.trim().slice(0, CHECKLIST_TEXT_MAX_LENGTH);
    if (!text) {
      setIsAddingItem(false);
      return;
    }

    if (orderedPackingItems.length >= CHECKLIST_LIMIT) {
      setChecklistError(`行前清單最多 ${CHECKLIST_LIMIT} 項`);
      return;
    }

    const nextSortOrder = orderedPackingItems.length;

    if (!itineraryUuid) {
      const draftItem = { id: `local-${Date.now()}`, text, checked: false, reminder: false, sortOrder: nextSortOrder };
      setPackingItems(prev => normalizeChecklistItems([...prev, draftItem]));
      setNewChecklistText('');
      setIsAddingItem(false);
      return;
    }

    setIsChecklistSyncing(true);
    try {
      const data = await requestChecklistApi('', {
        method: 'POST',
        body: JSON.stringify({ text, checked: false, reminder: false, sortOrder: nextSortOrder }),
      });
      setPackingItems(prev => normalizeChecklistItems([...prev, data.item]));
      setNewChecklistText('');
      setIsAddingItem(false);
    } catch (err) {
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const toggleChecklistChecked = async (id) => {
    if (isReadOnly || isChecklistSyncing) return;

    const item = orderedPackingItems.find((i) => String(i.id) === String(id));
    if (!item) return;
    const nextChecked = !item.checked;

    setPackingItems((prev) => normalizeChecklistItems(prev.map((i) => (String(i.id) === String(id) ? { ...i, checked: nextChecked } : i))));

    if (!itineraryUuid || String(id).startsWith('local-')) return;

    setIsChecklistSyncing(true);
    try {
      await requestChecklistApi(`/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ checked: nextChecked }),
      });
    } catch (err) {
      setPackingItems(prev => prev.map(i => i.id === id ? { ...i, checked: !nextChecked } : i));
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const removeChecklistItem = async (id) => {
    if (isReadOnly || isChecklistSyncing) return;

    const previousItems = orderedPackingItems;
    const nextItems = normalizeChecklistItems(previousItems.filter((item) => String(item.id) !== String(id)));
    const removed = previousItems.find((item) => String(item.id) === String(id));

    setPackingItems(nextItems);

    if (!itineraryUuid || String(id).startsWith('local-')) return;

    setIsChecklistSyncing(true);
    try {
      await requestChecklistApi(`/${id}`, { method: 'DELETE' });
      try {
        await persistChecklistOrder(previousItems, nextItems);
      } catch (orderError) {
        setChecklistError(orderError.message);
      }
    } catch (err) {
      if (removed) {
        setPackingItems(previousItems);
      }
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const startEditChecklistItem = (id, text) => {
    if (isReadOnly || isChecklistSyncing) return;
    setEditingChecklistId(id);
    setEditingChecklistText(text);
  };

  const finishEditChecklistItem = async () => {
    if (editingChecklistId === null) return;
    const text = editingChecklistText.trim().slice(0, CHECKLIST_TEXT_MAX_LENGTH);
    if (!text) {
      cancelEditChecklistItem();
      return;
    }

    setPackingItems((prev) => normalizeChecklistItems(prev.map((i) => (String(i.id) === String(editingChecklistId) ? { ...i, text } : i))));
    setEditingChecklistId(null);
    setEditingChecklistText('');

    if (!itineraryUuid || String(editingChecklistId).startsWith('local-')) return;

    setIsChecklistSyncing(true);
    try {
      await requestChecklistApi(`/${encodeURIComponent(editingChecklistId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      setChecklistError(err.message);
      const item = orderedPackingItems.find((i) => String(i.id) === String(editingChecklistId));
      if (item) {
        setPackingItems((prev) => normalizeChecklistItems(prev.map((i) => (String(i.id) === String(editingChecklistId) ? item : i))));
      }
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const cancelEditChecklistItem = () => {
    setEditingChecklistId(null);
    setEditingChecklistText('');
  };

  const doneCount = orderedPackingItems.filter((i) => i.checked).length;
  const progressPercent = orderedPackingItems.length === 0 ? 0 : Math.round((doneCount / orderedPackingItems.length) * 100);

  return (
    <div className="az-pretrip-card">
      <div className="az-pretrip-header">
        <h3 className="az-pretrip-title">旅行準備</h3>
        <div className="az-pretrip-header-right">
          <span className="az-pretrip-count">{doneCount}/{packingItems.length}</span>
        </div>
      </div>

      <div className="az-pretrip-progress-wrap">
        <div className="az-pretrip-progress">
          <div className="az-pretrip-progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="az-pretrip-progress-text">已完成 {doneCount} 項</span>
      </div>

      <div className="az-pretrip-list">
        {orderedPackingItems.length === 0 && isReadOnly && (
          <div className="az-pretrip-empty">尚未建立旅行準備項目</div>
        )}

        {orderedPackingItems.map((item) => {
          const isEditing = String(editingChecklistId) === String(item.id);
          return (
            <div
              key={String(item.id)}
              className={[
                'az-pretrip-row',
                item.checked ? 'az-pretrip-row--done' : '',
                isEditing ? 'az-pretrip-row--editing' : '',
              ].filter(Boolean).join(' ')}
            >
              <input
                type="checkbox"
                className="az-pretrip-checkbox"
                checked={item.checked}
                onChange={() => toggleChecklistChecked(item.id)}
                disabled={isReadOnly || isChecklistSyncing || isEditing}
              />
              <div className="az-pretrip-content">
                {isEditing ? (
                  <textarea
                    ref={editInputRef}
                    className="az-pretrip-edit-input"
                    value={editingChecklistText}
                    onChange={(e) => setEditingChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') finishEditChecklistItem();
                      if (e.key === 'Escape') cancelEditChecklistItem();
                    }}
                  />
                ) : (
                  <span
                    className={`az-pretrip-text${item.checked ? ' is-done' : ''}`}
                    onDoubleClick={() => startEditChecklistItem(item.id, item.text)}
                    style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                  >
                    {item.text}
                  </span>
                )}
              </div>
              {!isReadOnly && !isEditing && (
                <div className="az-pretrip-actions">
                  <button
                    className="az-pretrip-action az-pretrip-action--delete"
                    onClick={() => removeChecklistItem(item.id)}
                    disabled={isChecklistSyncing}
                    type="button"
                  >✕</button>
                </div>
              )}
              {!isReadOnly && isEditing && (
                <div className="az-pretrip-actions">
                  <button
                    className="az-pretrip-action az-pretrip-action--save"
                    onClick={finishEditChecklistItem}
                    disabled={isChecklistSyncing}
                    type="button"
                  >✓</button>
                  <button
                    className="az-pretrip-action az-pretrip-action--delete"
                    onClick={cancelEditChecklistItem}
                    disabled={isChecklistSyncing}
                    type="button"
                  >✕</button>
                </div>
              )}
            </div>
          );
        })}

        {!isReadOnly && (
          <>
            {isAddingItem ? (
              <div className="az-pretrip-row az-pretrip-row--adding">
                <div className="az-pretrip-checkbox az-pretrip-checkbox--placeholder" aria-hidden="true" />
                <textarea
                  ref={addInputRef}
                  className="az-pretrip-edit-input"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  placeholder="輸入清單項目..."
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') addChecklistItem();
                    if (e.key === 'Escape') setIsAddingItem(false);
                  }}
                />
                <div className="az-pretrip-actions">
                  <button onClick={addChecklistItem} className="az-pretrip-action--save" type="button">✓</button>
                  <button onClick={() => setIsAddingItem(false)} className="az-pretrip-action--delete" type="button">✕</button>
                </div>
              </div>
            ) : (
              orderedPackingItems.length < CHECKLIST_LIMIT && (
                <button className="az-pretrip-add-trigger" onClick={() => setIsAddingItem(true)} type="button">
                  + 新增項目
                </button>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PrepChecklist;