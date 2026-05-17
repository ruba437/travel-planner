// frontend/src/components/FavoriteButton.jsx
import { useFavorites } from '../page/Authentication/FavoritesContext';
import { useAuth } from '../page/Authentication/AuthContext';
import '../styles/favorite-button.css';

/**
 * FavoriteButton - 可重用的心形按鈕組件
 * 
 * Props:
 *   - itemId (required): string | number - 項目 ID
 *   - itemType (required): 'attraction' | 'poi' | 'itinerary' - 項目類型
 *   - metadata (optional): {name, image_url, address, lat, lng} - POI 元數據
 *   - size (optional): 'sm' | 'md' | 'lg' - 按鈕大小 (default: 'md')
 *   - onToggle (optional): callback(saved: boolean) - 切換後的回調
 *   - className (optional): 額外的 CSS 類名
 */
export default function FavoriteButton({
  itemId,
  itemType,
  metadata = null,
  size = 'md',
  onToggle = null,
  className = '',
}) {
  const { toggleFavorite, isFavorited, loading } = useFavorites();
  const { user } = useAuth();
  const isSaved = isFavorited(itemId, itemType);
  const isLoading = loading;

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      alert('請先登入以收藏項目');
      return;
    }

    const result = await toggleFavorite(itemId, itemType, metadata);
    if (result !== null && onToggle) {
      onToggle(result);
    }
  };

  return (
    <button
      className={`favorite-button favorite-button-${size} ${
        isSaved ? 'is-saved' : ''
      } ${isLoading ? 'is-loading' : ''} ${className}`}
      onClick={handleClick}
      type="button"
      aria-label={isSaved ? '取消收藏' : '收藏'}
      disabled={isLoading}
      title={isSaved ? '取消收藏' : '收藏'}
    >
      <svg
        className="favorite-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={isSaved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {isLoading && <span className="loading-spinner" />}
    </button>
  );
}
