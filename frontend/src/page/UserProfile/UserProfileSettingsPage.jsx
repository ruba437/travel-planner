import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Authentication/AuthContext';
import './UserProfileSettingsPage.css';

const API = import.meta.env.VITE_BACKEND_URL;

function formatBirthdayForInput(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
}

export default function UserProfileSettingsPage() {
  const { user, token, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [displayname, setDisplayname] = useState('');
  const [gender, setGender] = useState('secret');
  const [location, setLocation] = useState('');
  const [birthday, setBirthday] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const successTimer = useRef(null);

  // 當 user 資料從 AuthContext 進來時初始化表單
  useEffect(() => {
    if (user) {
      setDisplayname(user.displayname || user.displayName || '');
      setGender(user.gender || 'secret');
      setLocation(user.location || '');
      setBirthday(formatBirthdayForInput(user.birthday));
    }
  }, [user]);

  // 元件卸載時清掉計時器
  useEffect(() => () => clearTimeout(successTimer.current), []);

  const getUserInitial = () => {
    const n = user?.displayname || user?.displayName || user?.email || '?';
    return n.charAt(0).toUpperCase();
  };

  const avatarSrc = typeof user?.profilephoto === 'string' ? user.profilephoto.trim() : '';

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
    if (location.trim().length > 120) {
      setError('居住地最多 120 字。');
      return;
    }

    setLoading(true);
    try {
      await updateProfile({
        displayname: trimName,
        gender,
        location: location.trim() || null,
        birthday: birthday || null,
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

  return (
    <div className="az-profile-page">
      <div className="az-profile-shell">
        <div className="az-profile-card">
          <div className="az-profile-header az-profile-header--inside">
            <button className="az-profile-back" onClick={() => navigate(-1)} aria-label="返回">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              返回
            </button>
            <h1 className="az-profile-title">個人設定</h1>
          </div>

          <div className="az-profile-avatar-wrap" aria-hidden="true">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
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
              <label htmlFor="az-email" className="az-profile-label">Email</label>
              <input
                id="az-email"
                type="email"
                value={user?.email || ''}
                readOnly
                disabled
                className="az-profile-input az-profile-input--readonly"
              />
            </div>

            <div className="az-profile-field">
              <label htmlFor="az-gender" className="az-profile-label">性別</label>
              <select
                id="az-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="az-profile-input"
              >
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">其他</option>
                <option value="secret">保密</option>
              </select>
            </div>

            <div className="az-profile-field">
              <label htmlFor="az-location" className="az-profile-label">
                居住地
                <span className="az-profile-optional">（選填）</span>
              </label>
              <input
                id="az-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例如：台北市"
                maxLength={120}
                className="az-profile-input"
              />
            </div>

            <div className="az-profile-field">
              <label htmlFor="az-birthday" className="az-profile-label">
                生日
                <span className="az-profile-optional">（選填）</span>
              </label>
              <input
                id="az-birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
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
        </div>
      </div>
    </div>
  );
}
