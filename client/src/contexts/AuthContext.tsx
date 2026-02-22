import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/lpmsApi';
import { User } from '../types';
import { AuthContext } from './AuthContextStore';

const REFRESH_TOKEN_KEY = 'lpms_refresh_token';

const getStoredRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

const setStoredRefreshToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
    return;
  }
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setStoredRefreshToken(null);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      clearSession();
      return null;
    }

    const refreshed = await authApi.refresh(refreshToken);
    setAccessToken(refreshed.accessToken);
    const me = await authApi.me(refreshed.accessToken);
    setUser(me.user);
    return refreshed.accessToken;
  }, [clearSession]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await refreshAccessToken();
      } catch {
        clearSession();
      } finally {
        setIsBootstrapping(false);
      }
    };
    bootstrap();
  }, [clearSession, refreshAccessToken]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    setAccessToken(response.accessToken);
    setStoredRefreshToken(response.refreshToken);
    setUser(response.user);
    return response.user;
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    const token = accessToken || (await refreshAccessToken());
    if (!token) {
      throw new Error('Session expired. Please login again.');
    }

    const response = await authApi.changePassword(token, oldPassword, newPassword);
    setUser(response.user);
    return response.user;
  }, [accessToken, refreshAccessToken]);

  const logout = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const getAccessToken = useCallback(async () => {
    if (accessToken) {
      return accessToken;
    }

    try {
      return await refreshAccessToken();
    } catch {
      clearSession();
      return null;
    }
  }, [accessToken, clearSession, refreshAccessToken]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      changePassword,
      logout,
      getAccessToken
    }),
    [accessToken, changePassword, getAccessToken, isBootstrapping, login, logout, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
