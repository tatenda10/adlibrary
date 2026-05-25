import { createContext, useContext, useMemo, useState } from 'react';
import { adminLogin as apiAdminLogin } from '../lib/api.js';

const ADMIN_TOKEN_KEY = 'admin_auth_token';
const ADMIN_USER_KEY = 'admin_auth_user';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) || '');
  const [admin, setAdmin] = useState(() => {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async ({ username, password }) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiAdminLogin({ username, password });
      setToken(data.token || '');
      setAdmin(data.admin || null);
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token || '');
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(data.admin || null));
      return true;
    } catch (err) {
      setError(err.message || 'Failed to login');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken('');
    setAdmin(null);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  };

  const value = useMemo(
    () => ({
      token,
      admin,
      loading,
      error,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [admin, error, loading, token],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
}
