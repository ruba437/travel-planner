/* frontend/src/page/Authentication/Login/LoginPage.jsx */
import './LoginPage.css';
import { useState } from 'react';
import { useAuth } from '../AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, displayName);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="az-auth-page">
      <div className="az-auth-card-shell">
        <div className="az-auth-atmosphere" aria-hidden="true" />

        <div className="az-auth-card">
          <div className="az-auth-header">
            <span className="az-auth-dot" />
            <span className="az-auth-title">旅遊聊天小助手</span>
          </div>

          <h2 className="az-auth-heading">{isRegister ? '註冊帳號' : '登入'}</h2>

          <form onSubmit={handleSubmit} className="az-auth-form">
            {isRegister && (
              <input
                type="text"
                placeholder="顯示名稱"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="az-auth-input"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="az-auth-input"
            />
            <input
              type="password"
              placeholder="密碼"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="az-auth-input"
            />
            {error && <div className="az-auth-error" aria-live="polite">{error}</div>}
            <button type="submit" disabled={loading} className="az-auth-submit-btn">
              {loading ? '處理中...' : isRegister ? '註冊' : '登入'}
            </button>
          </form>

          <div className="az-auth-toggle">
            {isRegister ? '已有帳號？' : '還沒有帳號？'}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="az-auth-toggle-btn"
            >
              {isRegister ? '登入' : '註冊'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
