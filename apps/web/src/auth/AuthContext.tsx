import { useCallback, useEffect, useMemo, useState } from "react";

import { request, tokenStore, tryRefresh } from "@/api/http";
import type { AuthResponse, UserDto } from "@/api/types";
import { AuthContext } from "@/auth/context";

async function resolveCurrentUser(): Promise<UserDto | null> {
  // No local token yet: try the shared SSO cookie so an already-authenticated
  // session on a sibling subdomain logs us in silently (no login screen).
  if (!tokenStore.access) {
    const ok = await tryRefresh();
    if (!ok) return null;
  }
  try {
    return await request<UserDto>("/api/auth/me");
  } catch {
    tokenStore.clear();
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      const me = await resolveCurrentUser();
      if (!active) return;
      setUser(me);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

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
