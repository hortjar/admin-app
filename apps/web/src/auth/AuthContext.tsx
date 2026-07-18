import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { request, tokenStore, tryRefresh } from "@/api/http";
import type { AuthResponse, UserDto } from "@/api/types";

interface AuthState {
  user: UserDto | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    // No local token yet: try the shared SSO cookie so an already-authenticated
    // session on a sibling subdomain logs us in silently (no login screen).
    if (!tokenStore.access) {
      const ok = await tryRefresh();
      if (!ok) {
        setLoading(false);
        return;
      }
    }
    try {
      const me = await request<UserDto>("/api/auth/me");
      setUser(me);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await request<AuthResponse>("/api/auth/login", {
      method: "POST",
      anonymous: true,
      body: { email, password, app: "admin" },
    });
    tokenStore.set(res.accessToken, res.refreshToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    const refreshToken = tokenStore.refresh;
    if (refreshToken) {
      void request("/api/auth/logout", { method: "POST", anonymous: true, body: { refreshToken } });
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
