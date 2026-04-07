import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './GuideDetailPage.css';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function GuideDetailPage() {
  const navigate = useNavigate();
  const { username, guideSlug } = useParams();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadGuide() {
      setLoading(true);
      setError('');
      try {
        /**
         * 💡 優化策略：
         * 由於你遇到了 404 與 500 錯誤，我們優先使用最通用的 ID 介面。
         * 如果你的後端支持 /api/guides/:id，這通常是最穩定的路徑。
         */
        const res = await fetch(`${API_BASE}/api/guides/${encodeURIComponent(guideSlug)}`, { 
          signal: controller.signal 
        });

        if (!res.ok) {
          // 針對不同狀態碼給予明確提示
          if (res.status === 404) throw new Error('找不到這篇旅遊指南 (404)');
          if (res.status === 500) throw new Error('伺服器資料處理異常 (500)');
          throw new Error(`載入失敗 (狀態碼: ${res.status})`);
        }

        const data = await res.json();
        
        // 確保 data 內確實含有 guide 物件
        if (!data || !data.guide) {
          throw new Error('回傳資料格式不正確');
        }
        
        setGuide(data.guide);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Fetch Guide Error:', err);
        setError(err.message || '載入指南失敗');
      } finally {
        setLoading(false);
      }
    }

    loadGuide();
    return () => controller.abort();
  }, [guideSlug]);

  // 格式化日期函數 (加入安全檢查)
  const formatDate = (dateStr) => {
    if (!dateStr) return '尚未發布';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '日期格式錯誤';
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // 處理進入 Planner 檢視
  const handleViewInPlanner = () => {
    navigate(`/guides/${encodeURIComponent(guideSlug)}/planner`);
  };

  // 1. 載入中狀態
  if (loading) {
    return (
      <div className="guide-page-root">
        <div className="guide-shell">
          <div className="guide-skeleton" style={{ height: '40px', width: '30%' }} />
          <div className="guide-skeleton" style={{ height: '60px', marginTop: '20px' }} />
          <div className="guide-skeleton guide-skeleton-long" style={{ height: '200px', marginTop: '20px' }} />
        </div>
      </div>
    );
  }

  // 2. 錯誤狀態
  if (error || !guide) {
    return (
      <div className="guide-page-root">
        <div className="guide-shell guide-error-shell">
          <h1 style={{ color: '#ef4444' }}>抱歉，無法讀取指南</h1>
          <p style={{ margin: '16px 0', color: '#6b7280' }}>原因：{error || '內容不存在'}</p>
          <button type="button" className="guide-back-btn" onClick={() => navigate('/')}>
            回首頁
          </button>
        </div>
      </div>
    );
  }

  // 3. 正常渲染 (使用 Optional Chaining ?. 確保不崩潰)
  return (
    <div className="guide-page-root">
      <article className="guide-shell">
        <button type="button" className="guide-back-btn" onClick={() => navigate(-1)}>
          ← 返回
        </button>

        <header className="guide-header">
          <div className="guide-header-top">
            <div>
              <div className="guide-location">
                {guide?.country ? `${guide.country}・` : ''}
                {guide?.city || '未分類地區'}
              </div>
              <h1>{guide?.title || '未命名指南'}</h1>
              <p className="guide-summary">{guide?.summary || '這份指南尚未提供摘要描述。'}</p>
            </div>
            <button 
              type="button"
              className="guide-planner-btn"
              onClick={handleViewInPlanner}
              title="用 Planner 檢視行程詳情"
            >
              📋 用 Planner 檢視
            </button>
          </div>
        </header>

        <section className="guide-meta-grid">
          <div className="guide-meta-card">
            <div className="guide-meta-label">作者</div>
            <div className="guide-meta-value">{guide?.author?.displayName || '匿名旅人'}</div>
          </div>
          <div className="guide-meta-card">
            <div className="guide-meta-label">旅程天數</div>
            <div className="guide-meta-value">
              {guide?.tripInfo?.days || '--'} 天 {guide?.tripInfo?.nights ? `${guide?.tripInfo?.nights} 夜` : null}
            </div>
          </div>
          <div className="guide-meta-card">
            <div className="guide-meta-label">統計資訊</div>
            <div className="guide-meta-value">{formatDate(guide?.publishedAt)}</div>
            {/* <div className="guide-meta-sub">瀏覽次數：{guide?.viewCount || 0}</div> */}
          </div>
        </section>

        {/* 標籤區塊 */}
        {Array.isArray(guide?.tags) && guide.tags.length > 0 && (
          <section className="guide-tags">
            {guide.tags.map((tag) => (
              <span key={tag} className="guide-tag">#{tag}</span>
            ))}
          </section>
        )}

        {/* 內容區塊 */}
        <section className="guide-content">
          {guide?.body ? (
            guide.body.split(/\n+/).filter(Boolean).map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))
          ) : (
            <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>目前尚未提供完整內文。</p>
          )}
        </section>
      </article>
    </div>
  );
}