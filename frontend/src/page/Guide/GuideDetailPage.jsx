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
        const firstUrl = `${API_BASE}/api/u/${encodeURIComponent(username)}/guide/${encodeURIComponent(guideSlug)}`;
        let res = await fetch(firstUrl, { signal: controller.signal });

        if (res.status === 404) {
          const fallbackUrl = `${API_BASE}/api/guides/${encodeURIComponent(guideSlug)}`;
          res = await fetch(fallbackUrl, { signal: controller.signal });
        }

        if (!res.ok) throw new Error('找不到這篇旅遊指南');

        const data = await res.json();
        setGuide(data.guide || null);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || '載入指南失敗');
      } finally {
        setLoading(false);
      }
    }

    loadGuide();
    return () => controller.abort();
  }, [username, guideSlug]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '尚未標記發布日期';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '尚未標記發布日期';
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  if (loading) {
    return (
      <div className="guide-page-root">
        <div className="guide-shell">
          <div className="guide-skeleton" />
          <div className="guide-skeleton guide-skeleton-long" />
          <div className="guide-skeleton guide-skeleton-long" />
        </div>
      </div>
    );
  }

  if (error || !guide) {
    return (
      <div className="guide-page-root">
        <div className="guide-shell guide-error-shell">
          <h1>這篇指南目前無法查看</h1>
          <p>{error || '找不到對應內容'}</p>
          <button type="button" className="guide-back-btn" onClick={() => navigate('/')}>
            回首頁
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="guide-page-root">
      <article className="guide-shell">
        <button type="button" className="guide-back-btn" onClick={() => navigate('/')}>
          回首頁
        </button>

        <header className="guide-header">
          <div className="guide-location">{guide.country ? `${guide.country}・` : ''}{guide.city || '未分類地區'}</div>
          <h1>{guide.title}</h1>
          <p className="guide-summary">{guide.summary || '這份指南尚未提供摘要。'}</p>
        </header>

        <section className="guide-meta-grid">
          <div className="guide-meta-card">
            <div className="guide-meta-label">作者</div>
            <div className="guide-meta-value">{guide.author?.displayName || '匿名旅人'}</div>
            <div className="guide-meta-sub">@{guide.author?.username || username}</div>
          </div>
          <div className="guide-meta-card">
            <div className="guide-meta-label">旅程天數</div>
            <div className="guide-meta-value">{guide.tripInfo?.days || '--'} 天 {guide.tripInfo?.nights || '--'} 夜</div>
            <div className="guide-meta-sub">行程代碼：{guide.guideCode || 'N/A'}</div>
          </div>
          <div className="guide-meta-card">
            <div className="guide-meta-label">發布日期</div>
            <div className="guide-meta-value">{formatDate(guide.publishedAt)}</div>
            <div className="guide-meta-sub">瀏覽：{guide.viewCount || 0}</div>
          </div>
        </section>

        {Array.isArray(guide.tags) && guide.tags.length > 0 && (
          <section className="guide-tags">
            {guide.tags.map((tag) => (
              <span key={tag} className="guide-tag">#{tag}</span>
            ))}
          </section>
        )}

        <section className="guide-content">
          {(guide.body || '')
            .split(/\n+/)
            .filter(Boolean)
            .map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          {!guide.body && <p>目前尚未提供完整內文。</p>}
        </section>
      </article>
    </div>
  );
}
