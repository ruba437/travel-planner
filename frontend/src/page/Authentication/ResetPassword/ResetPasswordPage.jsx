import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import '../ForgotPassword/ForgotPasswordPage.css';
import './ResetPasswordPage.css';

function getStrength(pw) {
  if (!pw) return { level: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: '太弱', color: '#ef4444' };
  if (score === 2) return { level: 2, label: '弱', color: '#f97316' };
  if (score === 3) return { level: 3, label: '普通', color: '#eab308' };
  if (score === 4) return { level: 4, label: '強', color: '#22c55e' };
  return { level: 5, label: '非常強', color: '#10b981' };
}

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(null);

  const strength = getStrength(newPassword);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { navigate('/login'); return; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('缺少重設 token，請重新開啟 Email 內的連結。');
      return;
    }
    if (newPassword.length < 8) {
      setError('新密碼至少 8 碼。');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('兩次輸入的密碼不一致。');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(token, newPassword);
      setMessage(result);
      setNewPassword('');
      setConfirmPassword('');
      setCountdown(2);
    } catch (err) {
      setError(err.message || '重設密碼失敗，請稍後再試。');
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
            <span className="az-auth-title">設定新密碼</span>
          </div>

          <h2 className="az-auth-heading">重設密碼</h2>
          <p className="az-auth-caption">請輸入新的密碼，完成後即可使用新密碼登入。</p>

          <form onSubmit={onSubmit} className="az-auth-form">
            <div className="az-pw-field">
              <input
                type="password"
                placeholder="新密碼（至少 8 碼）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="az-auth-input"
              />
              {newPassword && (
                <div className="az-pw-strength">
                  <div className="az-pw-bars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className="az-pw-bar"
                        style={{ background: n <= strength.level ? strength.color : '#e5e7eb' }}
                      />
                    ))}
                  </div>
                  <span className="az-pw-label" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>
            <input
              type="password"
              placeholder="確認新密碼"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="az-auth-input"
            />

            {error && <div className="az-auth-error" aria-live="polite">{error}</div>}
            {message && (
              <div className="az-auth-success" aria-live="polite">
                {message}
                {countdown !== null && (
                  <span className="az-redirect-hint">　{countdown} 秒後自動跳回登入頁…</span>
                )}
              </div>
            )}

            <button type="submit" disabled={loading || countdown !== null} className="az-auth-submit-btn">
              {loading ? '更新中...' : '更新密碼'}
            </button>
          </form>

          <div className="az-auth-toggle">
            <Link to="/login" className="az-auth-toggle-btn az-auth-toggle-link">
              回登入頁
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
