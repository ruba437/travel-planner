// frontend/src/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API = import.meta.env.VITE_BACKEND_URL;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登入失敗');
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  // edit
  const register = async (email, password, displayName) => {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '註冊失敗');
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const forgotPassword = async (email) => {
    const res = await fetch(`${API}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '忘記密碼請求失敗');
    return data.message || '如果帳號存在，我們已寄出密碼重設信。';
  };

  const resetPassword = async (tokenValue, newPassword) => {
    const res = await fetch(`${API}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenValue, newPassword }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '重設密碼失敗');
    return data.message || '密碼已重設成功，請重新登入';
  };

  const updateProfile = async (fields) => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) throw new Error('未登入');

    const res = await fetch(`${API}/api/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify(fields),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || '更新失敗');

    // 同步更新 AuthContext 內的 user 狀態
    setUser((prev) => ({ ...prev, ...data.data }));
    return data.data;
  };
  //

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
