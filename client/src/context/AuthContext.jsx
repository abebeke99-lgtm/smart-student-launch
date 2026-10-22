import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, jsonBody } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(sessionStorage.getItem('cafeteriaToken')));

  const refreshUser = useCallback(async () => {
    const token = sessionStorage.getItem('cafeteriaToken');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await api('/auth/me');
      setUser(response.data.user);
    } catch {
      sessionStorage.removeItem('cafeteriaToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = async (email, password) => {
    const response = await api('/auth/login', {
      method: 'POST',
      body: jsonBody({ email, password }),
    });
    sessionStorage.setItem('cafeteriaToken', response.data.token);
    setUser(response.data.user);
    return response.data.user;
  };

  const register = async (name, email, password) => {
    const response = await api('/auth/register', {
      method: 'POST',
      body: jsonBody({ name, email, password }),
    });
    sessionStorage.setItem('cafeteriaToken', response.data.token);
    setUser(response.data.user);
    return response.data.user;
  };

  const logout = async () => {
    try {
      if (sessionStorage.getItem('cafeteriaToken')) {
        await api('/auth/logout', { method: 'POST' });
      }
    } finally {
      sessionStorage.removeItem('cafeteriaToken');
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
