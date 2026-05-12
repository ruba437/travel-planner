import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './ForgotPasswordPage.css';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const result = await forgotPassword(email.trim());
      setMessage(result);
    } catch (err) {
      setError(err.message || '送出失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="az-auth-page az-reset-page">
      <div className="az-auth-card-shell">
        <div className="az-auth-atmosphere" aria-hidden="true" />

        <div className="az-auth-card">
          <div className="az-auth-header">
            <span className="az-auth-dot" />
            <span className="az-auth-title">重設密碼</span>
          </div>

          <h2 className="az-auth-heading">忘記密碼</h2>
          <p className="az-auth-caption">輸入你的 Email，我們會寄送密碼重設連結。</p>

          <form onSubmit={onSubmit} className="az-auth-form">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="az-auth-input"
            />

            {error && <div className="az-auth-error" aria-live="polite">{error}</div>}
            {message && <div className="az-auth-success" aria-live="polite">{message}</div>}

            <button type="submit" disabled={loading} className="az-auth-submit-btn">
              {loading ? '寄送中...' : '寄送重設連結'}
            </button>
          </form>

          <div className="az-auth-toggle">
            想起密碼了？
            <Link to="/login" className="az-auth-toggle-btn az-auth-toggle-link">
              回登入頁
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
