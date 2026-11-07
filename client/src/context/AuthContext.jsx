import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const storedUser = localStorage.getItem('hqms_user');
      const token = localStorage.getItem('hqms_token');
      if (!storedUser || !token) {
        setLoading(false);
        return;
      }
      // Optimistically show the cached user, then confirm with the server -
      // if the token expired or the account was deactivated, /me will 401
      // and the response interceptor in services/api.js clears the session.
      setUser(JSON.parse(storedUser));
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        localStorage.setItem('hqms_user', JSON.stringify(data.user));
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('hqms_token', data.token);
    localStorage.setItem('hqms_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('hqms_token');
    localStorage.removeItem('hqms_user');
    setUser(null);
  }

  const value = { user, loading, login, logout, isAuthenticated: !!user };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
