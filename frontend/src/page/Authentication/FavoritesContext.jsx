// frontend/src/page/Authentication/FavoritesContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const FavoritesContext = createContext(null);

const API = import.meta.env.VITE_BACKEND_URL;

/**
 * FavoritesContext 提供全局收藏管理
 * - 樂觀 UI 更新（立即更新本地狀態，然後 API 驗證）
 * - 支援多種類型：'attraction' | 'poi' | 'itinerary'
 * - 提供 toggleFavorite、isFavorited、fetchFavorites 方法
 */
export function FavoritesProvider({ children }) {
  const { token } = useAuth();
  const [favoritesList, setFavoritesList] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * 初始化：從後端獲取用戶的所有收藏
   */
  const fetchFavorites = async () => {
    if (!token) {
      setFavoritesList([]);
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error('Failed to fetch favorites');
      // json.data should be an array of favorites
      setFavoritesList(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error('Fetch favorites error:', e);
      setFavoritesList([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 檢查項目是否已收藏
   */
  const isFavorited = (itemId, itemType) => {
    return favoritesList.some(
      (fav) => fav.item_id === String(itemId) && fav.item_type === itemType
    );
  };

  /**
   * 樂觀 UI 更新：切換收藏狀態
   * 流程：
   * 1. 立即更新本地狀態（樂觀更新）
   * 2. 調用 API /toggle
   * 3. 如果失敗，回滾本地狀態
   */
  const toggleFavorite = async (itemId, itemType, metadata = null) => {
    if (!token) {
      alert('請先登入');
      return false;
    }

    const itemIdStr = String(itemId);
    const currentlySaved = isFavorited(itemIdStr, itemType);
    
    // 1. 樂觀更新：立即更新本地狀態
    const previousList = [...favoritesList];
    if (currentlySaved) {
      // 移除
      setFavoritesList(
        favoritesList.filter(
          (fav) => !(fav.item_id === itemIdStr && fav.item_type === itemType)
        )
      );
    } else {
      // 新增
      const newFavorite = {
        id: Date.now(), // 臨時 ID，會被 API 回應覆蓋
        userid: null, // 後端會填充
        item_id: itemIdStr,
        item_type: itemType,
        metadata: metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : null,
        created_at: new Date().toISOString(),
      };
      setFavoritesList([newFavorite, ...favoritesList]);
    }

    // 2. 調用 API
    try {
      const res = await fetch(`${API}/api/favorites/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_id: itemIdStr,
          item_type: itemType,
          metadata: metadata && typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error('Failed to toggle favorite');
      }

      // 返回後端的 saved 狀態
      return json.data?.saved ?? null;
    } catch (e) {
      console.error('Toggle favorite error:', e);
      
      // 失敗時回滾本地狀態
      setFavoritesList(previousList);
      
      alert('操作失敗，請重試');
      return null;
    }
  };

  /**
   * 當 token 改變時，重新獲取收藏列表
   */
  useEffect(() => {
    if (token) {
      fetchFavorites();
    } else {
      setFavoritesList([]);
    }
  }, [token]);

  const value = {
    favoritesList,
    loading,
    toggleFavorite,
    isFavorited,
    fetchFavorites,
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

/**
 * Hook：在組件中使用收藏功能
 */
export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return context;
}
