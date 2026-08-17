"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, api, getRefreshToken, getToken, setTokens } from "./api";

export type CompanySession = {
  kind: "company";
  id: string;
  email: string;
  name: string;
  roleId: string;
  companyId: string;
  roleName: string;
  permissions: string[];
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
};

export type SuperadminSession = {
  kind: "superadmin";
  id: string;
  email: string;
  name: string;
};

export type Me = CompanySession | SuperadminSession;

type CompanyUser = Omit<CompanySession, "kind">;
type SuperadminUser = Omit<SuperadminSession, "kind">;

const AUTH_KIND_KEY = "erp_auth_kind";

function getAuthKind(): "company" | "superadmin" | null {
  if (typeof window === "undefined") return null;
  const kind = window.localStorage.getItem(AUTH_KIND_KEY);
  return kind === "company" || kind === "superadmin" ? kind : null;
}

function setAuthKind(kind: "company" | "superadmin" | null): void {
  if (typeof window === "undefined") return;
  if (kind) window.localStorage.setItem(AUTH_KIND_KEY, kind);
  else window.localStorage.removeItem(AUTH_KIND_KEY);
}

type AuthContextValue = {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<Me>;
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
      setAuthKind("company");
      const me = await api<CompanyUser>("/auth/me");
      setUser({ kind: "company", ...me });
    } catch {
      setTokens(null, null);
      setAuthKind(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const restoreSuperadmin = useCallback(async () => {
    const accessToken = getToken();
    if (!accessToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<SuperadminUser>("/admin/me");
      setUser({ kind: "superadmin", ...me });
    } catch (err) {
      setUser(null);
      if (err instanceof ApiError && err.status === 401) {
        setTokens(null, null);
        setAuthKind(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getAuthKind() === "superadmin") {
      void restoreSuperadmin();
    } else {
      void refresh();
    }
  }, [refresh, restoreSuperadmin]);

  const login = useCallback(async (email: string, password: string, totpCode?: string): Promise<Me> => {
    try {
      const tokens = await api<{ accessToken: string; refreshToken: string }>("/auth/login", {
        method: "POST",
        body: { email, password, ...(totpCode ? { totpCode } : {}) },
      });
      setTokens(tokens.accessToken, tokens.refreshToken);
      setAuthKind("company");
      const me = await api<CompanyUser>("/auth/me");
      const session: Me = { kind: "company", ...me };
      setUser(session);
      return session;
    } catch (err) {
      if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 403)) {
        throw err;
      }
    }
    const tokens = await api<{ accessToken: string }>("/admin/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setTokens(tokens.accessToken, null);
    setAuthKind("superadmin");
    const me = await api<SuperadminUser>("/admin/me");
    const session: Me = { kind: "superadmin", ...me };
    setUser(session);
    return session;
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
    setAuthKind(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
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
