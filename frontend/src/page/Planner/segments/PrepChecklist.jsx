import React, { useState, useRef, useEffect } from 'react';
import { usePlanner, API_BASE } from '../PlannerProvider';

const CHECKLIST_LIMIT = 10;
const CHECKLIST_TEXT_MAX_LENGTH = 800;

const PrepChecklist = ({ isReadOnly = false }) => {
  const {
    packingItems,
    setPackingItems,
    itineraryUuid,
    token,
    isChecklistSyncing,
    setIsChecklistSyncing,
    setSaveMsg,
    API_BASE // 確保 Provider 有匯出此常數，或在此處定義
  } = usePlanner();

  // 內部 UI 狀態
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editingChecklistText, setEditingChecklistText] = useState('');
  const addInputRef = useRef(null);

  // 自動對焦新增輸入框
  useEffect(() => {
    if (isAddingItem && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAddingItem]);

  // --- 內部輔助函數 ---
  const setChecklistError = (message) => {
    setSaveMsg(message || '行前清單更新失敗');
    setTimeout(() => setSaveMsg(null), 2500);
  };

  const requestChecklistApi = async (path = '', options = {}) => {
    if (!itineraryUuid) throw new Error('請先儲存行程後再同步清單');
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

  // --- 操作邏輯 ---
  const addChecklistItem = async () => {
    const text = newChecklistText.trim().slice(0, CHECKLIST_TEXT_MAX_LENGTH);
    if (!text) {
      setIsAddingItem(false);
      return;
    }
    if (packingItems.length >= CHECKLIST_LIMIT) {
      setChecklistError(`行前清單最多 ${CHECKLIST_LIMIT} 項`);
      return;
    }

    if (!itineraryUuid) {
      // 離線模式
      const draftItem = { id: `local-${Date.now()}`, text, checked: false, reminder: false, sortOrder: packingItems.length };
      setPackingItems(prev => [...prev, draftItem]);
      setNewChecklistText('');
      setIsAddingItem(false);
      return;
    }

    setIsChecklistSyncing(true);
    try {
      const data = await requestChecklistApi('', {
        method: 'POST',
        body: JSON.stringify({ text, checked: false, reminder: false, sortOrder: packingItems.length }),
      });
      setPackingItems(prev => [...prev, data.item]);
      setNewChecklistText('');
      setIsAddingItem(false);
    } catch (err) {
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  const toggleChecklistChecked = async (id) => {
    const item = packingItems.find(i => i.id === id);
    if (!item) return;
    const nextChecked = !item.checked;

    setPackingItems(prev => prev.map(i => i.id === id ? { ...i, checked: nextChecked } : i));

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
    const removed = packingItems.find(i => i.id === id);
    setPackingItems(prev => prev.filter(i => i.id !== id));

    if (!itineraryUuid || String(id).startsWith('local-')) return;

    setIsChecklistSyncing(true);
    try {
      await requestChecklistApi(`/${id}`, { method: 'DELETE' });
    } catch (err) {
      setPackingItems(prev => [...prev, removed]);
      setChecklistError(err.message);
    } finally {
      setIsChecklistSyncing(false);
    }
  };

  // --- 計算屬性 ---
  const doneCount = packingItems.filter(i => i.checked).length;
  const progressPercent = packingItems.length === 0 ? 0 : Math.round((doneCount / packingItems.length) * 100);

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
        {packingItems.map((item) => (
          <div key={item.id} className={`az-pretrip-row${item.checked ? ' az-pretrip-row--done' : ''}`}>
            <input
              type="checkbox"
              className="az-pretrip-checkbox"
              checked={item.checked}
              onChange={() => toggleChecklistChecked(item.id)}
              disabled={isReadOnly || isChecklistSyncing}
            />
            <div className="az-pretrip-content">
              <span className={`az-pretrip-text${item.checked ? ' is-done' : ''}`}>
                {item.text}
              </span>
            </div>
            {!isReadOnly && (
              <div className="az-pretrip-actions">
                <button 
                  className="az-pretrip-action az-pretrip-action--delete"
                  onClick={() => removeChecklistItem(item.id)}
                  disabled={isChecklistSyncing}
                >✕</button>
              </div>
            )}
          </div>
        ))}

        {!isReadOnly && (
          <>
            {isAddingItem ? (
              <div className="az-pretrip-row az-pretrip-row--adding">
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
                  <button onClick={addChecklistItem} className="az-pretrip-action--save">✓</button>
                  <button onClick={() => setIsAddingItem(false)} className="az-pretrip-action--delete">✕</button>
                </div>
              </div>
            ) : (
              packingItems.length < CHECKLIST_LIMIT && (
                <button className="az-pretrip-add-trigger" onClick={() => setIsAddingItem(true)}>
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