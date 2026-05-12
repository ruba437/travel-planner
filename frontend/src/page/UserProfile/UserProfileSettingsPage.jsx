import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';
import './UserProfileSettingsPage.css';

const API = import.meta.env.VITE_BACKEND_URL;

export default function UserProfileSettingsPage() {
  const { user, token, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [displayname, setDisplayname] = useState('');
  const [profilephoto, setProfilephoto] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const successTimer = useRef(null);

  // 當 user 資料從 AuthContext 進來時初始化表單
  useEffect(() => {
    if (user) {
      setDisplayname(user.displayname || user.displayName || '');
      setProfilephoto(user.profilephoto || '');
    }
  }, [user]);

  // 元件卸載時清掉計時器
  useEffect(() => () => clearTimeout(successTimer.current), []);

  const getUserInitial = () => {
    const n = user?.displayname || user?.displayName || user?.email || '?';
    return n.charAt(0).toUpperCase();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimName = displayname.trim();
    if (!trimName) {
      setError('顯示名稱不能為空。');
      return;
    }
    if (trimName.length > 60) {
      setError('顯示名稱最多 60 字。');
      return;
    }
    if (profilephoto.trim() && !/^https?:\/\/.+/.test(profilephoto.trim())) {
      setError('頭像 URL 必須是 http 或 https 連結。');
      return;
    }

    setLoading(true);
    try {
      await updateProfile({
        displayname: trimName,
        profilephoto: profilephoto.trim() || null,
      });
      setSuccess('個人資料已更新！');
      successTimer.current = setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || '更新失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  if (!user && !token) {
    navigate('/login');
    return null;
  }

  const avatarSrc = profilephoto.trim() || (user?.profilephoto || '');

  return (
    <div className="az-profile-page">
      <div className="az-profile-shell">
        <div className="az-profile-header">
          <button className="az-profile-back" onClick={() => navigate(-1)} aria-label="返回">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            返回
          </button>
          <h1 className="az-profile-title">個人設定</h1>
        </div>

        <div className="az-profile-card">
          {/* 頭像預覽 */}
          <div className="az-profile-avatar-wrap">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="頭像預覽"
                className="az-profile-avatar-img"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="az-profile-avatar-fallback">{getUserInitial()}</div>
            )}
          </div>

          <form onSubmit={onSubmit} className="az-profile-form">
            <div className="az-profile-field">
              <label htmlFor="az-displayname" className="az-profile-label">顯示名稱</label>
              <input
                id="az-displayname"
                type="text"
                value={displayname}
                onChange={(e) => setDisplayname(e.target.value)}
                placeholder="輸入顯示名稱"
                maxLength={60}
                required
                className="az-profile-input"
              />
            </div>

            <div className="az-profile-field">
              <label htmlFor="az-profilephoto" className="az-profile-label">
                頭像圖片 URL
                <span className="az-profile-optional">（選填）</span>
              </label>
              <input
                id="az-profilephoto"
                type="url"
                value={profilephoto}
                onChange={(e) => setProfilephoto(e.target.value)}
                placeholder="https://example.com/avatar.png"
                className="az-profile-input"
              />
            </div>

            <div className="az-profile-footer">
              {error && <div className="az-profile-error" aria-live="polite">{error}</div>}
              {success && <div className="az-profile-success" aria-live="polite">{success}</div>}
              <button type="submit" disabled={loading} className="az-profile-submit">
                {loading ? '儲存中...' : '儲存變更'}
              </button>
            </div>
          </form>

          <div className="az-profile-meta">
            <span className="az-profile-meta-label">Email</span>
            <span className="az-profile-meta-value">{user?.email || ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
