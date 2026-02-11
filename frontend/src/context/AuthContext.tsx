import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/client';
import type { User } from '../types';

const TOKEN_KEY = 'pyce_token';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, displayName?: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u, token: t } = await authApi.signin(email, password);
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName?: string) => {
    const { user: u, token: t } = await authApi.signup(email, password, displayName);
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    return u;
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
