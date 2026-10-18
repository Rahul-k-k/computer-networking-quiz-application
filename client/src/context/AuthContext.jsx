import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setAuthToken } from '../api/client';

const AuthContext = createContext(null);
const TOKEN_KEY = 'speednet_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  // True for free-trial (guest) sessions. These live in memory ONLY — never
  // persisted — so a reload or new visit starts clean.
  const [isTrial, setIsTrial] = useState(false);

  // On first load, restore a PERSISTED (non-trial) session if present.
  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }
    setAuthToken(saved);
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        setToken(saved);
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY);
        setAuthToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const applySession = useCallback((nextToken, nextUser, { persist }) => {
    setToken(nextToken);
    setUser(nextUser);
    setAuthToken(nextToken);
    if (persist) {
      setIsTrial(false);
      window.localStorage.setItem(TOKEN_KEY, nextToken);
    } else {
      setIsTrial(true);
      // Belt-and-suspenders: make sure a trial can never leave a token behind.
      window.localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const login = useCallback(
    async (email, password) => {
      const res = await api.post('/auth/login', { email, password });
      applySession(res.data.token, res.data.user, { persist: true });
      return res.data.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (payload) => {
      const res = await api.post('/auth/register', payload);
      applySession(res.data.token, res.data.user, { persist: true });
      return res.data.user;
    },
    [applySession]
  );

  const loginTrial = useCallback(
    async (name) => {
      const res = await api.post('/auth/guest', { name });
      applySession(res.data.token, res.data.user, { persist: false });
      return res.data.user;
    },
    [applySession]
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setIsTrial(false);
    setAuthToken(null);
    window.localStorage.removeItem(TOKEN_KEY);
  }, []);

  const value = {
    user,
    token,
    loading,
    isTrial,
    isAuthenticated: Boolean(user),
    login,
    register,
    loginTrial,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
