"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, getRefreshToken, getToken, setTokens } from "./api";

export type Me = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  tenantId: string;
  plan: string;
};

type AuthContextValue = {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<Me>;
  signup: (input: { companyName: string; name: string; email: string; password: string; plan?: string }) => Promise<Me>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const tokens = await api<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
        method: "POST",
        body: { refreshToken },
      });
      setTokens(tokens.accessToken, tokens.refreshToken);
      const me = await api<Me>("/auth/me");
      setUser(me);
    } catch {
      setTokens(null, null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string, totpCode?: string) => {
    const tokens = await api<{ accessToken: string; refreshToken: string }>("/auth/login", {
      method: "POST",
      body: { email, password, ...(totpCode ? { totpCode } : {}) },
    });
    setTokens(tokens.accessToken, tokens.refreshToken);
    const me = await api<Me>("/auth/me");
    setUser(me);
    return me;
  }, []);

  const signup = useCallback(async (input: { companyName: string; name: string; email: string; password: string; plan?: string }) => {
    const tokens = await api<{ accessToken: string; refreshToken: string }>("/auth/signup", {
      method: "POST",
      body: input,
    });
    setTokens(tokens.accessToken, tokens.refreshToken);
    const me = await api<Me>("/auth/me");
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await api("/auth/logout", { method: "POST", body: { refreshToken } });
      } catch {
        // session may already be revoked
      }
    }
    setTokens(null, null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, refresh }),
    [user, loading, login, signup, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function hasToken(): boolean {
  return getToken() !== null;
}