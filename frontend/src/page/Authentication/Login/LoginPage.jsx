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
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.dot} />
          <span style={styles.title}>旅遊聊天小助手</span>
        </div>
        <h2 style={styles.heading}>{isRegister ? '註冊帳號' : '登入'}</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          {isRegister && (
            <input
              type="text"
              placeholder="顯示名稱"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={styles.input}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={styles.input}
          />
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? '處理中...' : isRegister ? '註冊' : '登入'}
          </button>
        </form>

        <div style={styles.toggle}>
          {isRegister ? '已有帳號？' : '還沒有帳號？'}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={styles.toggleBtn}
          >
            {isRegister ? '登入' : '註冊'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#f3f4f6',
  },
  card: {
    background: 'white', borderRadius: 12, padding: '32px 28px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', width: 360,
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24,
  },
  dot: {
    width: 10, height: 10, background: '#2563eb', borderRadius: '50%',
    display: 'inline-block',
  },
  title: { fontWeight: 700, fontSize: '1.1rem', color: '#111827' },
  heading: { margin: '0 0 20px', fontSize: '1.25rem', color: '#374151' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit',
  },
  error: {
    color: '#dc2626', fontSize: '0.85rem', padding: '6px 8px',
    background: '#fef2f2', borderRadius: 6,
  },
  button: {
    background: '#2563eb', color: 'white', border: 'none', borderRadius: 8,
    padding: '10px 0', fontWeight: 600, fontSize: '1rem', cursor: 'pointer',
  },
  toggle: {
    marginTop: 16, textAlign: 'center', fontSize: '0.9rem', color: '#6b7280',
  },
  toggleBtn: {
    background: 'none', border: 'none', color: '#2563eb',
    cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
  },
};
