/* frontend/src/page/Authentication/Login/LoginPage.jsx */
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fromPath = location.state?.from || '/';

  useEffect(() => {
    document.title = `${isRegister ? '註冊帳號' : '登入'} | Travel Planner`;
  }, [isRegister]);

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
      navigate(fromPath, { replace: true });
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
            {/* <span className="az-auth-dot" /> */}
            <img src="/favicon.ico" alt="" className="az-auth-dot" />
            <span className="az-auth-title">Rêverie 旅遊規劃器</span>
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
            <div className="az-auth-input-wrap">
              <span className="az-auth-input-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2"/>
                  <polyline points="3 7 12 13 21 7"/>
                </svg>
              </span>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="az-auth-input az-auth-input--with-icon"
              />
            </div>
            <div className="az-auth-input-wrap">
              <span className="az-auth-input-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2"/>
                  <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
                </svg>
              </span>
              <input
                type="password"
                placeholder="密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="az-auth-input az-auth-input--with-icon"
              />
            </div>
            {error && <div className="az-auth-error" aria-live="polite">{error}</div>}
            {!isRegister && (
              <div className="az-auth-row">
                <Link to="/forgot-password" className="az-auth-link">
                  忘記密碼？
                </Link>
              </div>
            )}
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
