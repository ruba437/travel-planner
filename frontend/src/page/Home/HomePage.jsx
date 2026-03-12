import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';
import './HomePage.css';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function HomePage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchItineraries();
  }, []);

  const fetchItineraries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/itineraries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('取得行程列表失敗');
      const data = await res.json();
      setItineraries(data.itineraries || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uuid) => {
    if (!window.confirm('確定要刪除這個行程嗎？')) return;
    setDeletingId(uuid);
    try {
      const res = await fetch(`${API_BASE}/api/itineraries/${uuid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('刪除失敗');
      setItineraries((prev) => prev.filter((it) => it.uuid !== uuid));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="home-root">
      <div className="home-header">
        <div className="home-header-inner">
          <div className="home-title">
            <span className="logo-dot" />
            旅遊規劃器
          </div>
          <div className="home-header-right">
            <span className="home-user">{user?.displayName || user?.displayname || user?.email}</span>
            <button onClick={logout} className="home-logout-btn">登出</button>
          </div>
        </div>
      </div>

      <div className="home-body">
        <div className="home-section-header">
          <h2>我的行程</h2>
          <button onClick={() => navigate('/planner')} className="home-new-btn">
            ＋ 新增行程
          </button>
        </div>

        {loading && <div className="home-status">載入中...</div>}
        {error && (
          <div className="home-status home-error">
            {error}
            <button onClick={fetchItineraries} className="home-retry-btn">重試</button>
          </div>
        )}

        {!loading && !error && itineraries.length === 0 && (
          <div className="home-empty">
            <div className="home-empty-icon">🗺️</div>
            <p>還沒有任何行程</p>
            <button onClick={() => navigate('/planner')} className="home-new-btn">開始規劃第一趟旅程</button>
          </div>
        )}

        {!loading && !error && itineraries.length > 0 && (
          <div className="home-grid">
            {itineraries.map((it) => (
              <div key={it.uuid} className="home-card" onClick={() => navigate(`/planner/${it.uuid}`)}>
                <div className="home-card-top">
                  <div className="home-card-city">{it.city || '未指定城市'}</div>
                  {it.startdate && <div className="home-card-date">📅 {formatDate(it.startdate)}</div>}
                </div>
                <div className="home-card-title">{it.title || it.summary || '無標題'}</div>
                {it.summary && it.title && (
                  <div className="home-card-summary">{it.summary}</div>
                )}
                <div className="home-card-bottom">
                  <span className="home-card-time">
                    更新於 {formatDate(it.updatedat)}
                  </span>
                  <button
                    className="home-card-delete"
                    disabled={deletingId === it.uuid}
                    onClick={(e) => { e.stopPropagation(); handleDelete(it.uuid); }}
                  >
                    {deletingId === it.uuid ? '...' : '刪除'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
