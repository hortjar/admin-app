import type { AuthResponse } from "./types";

const ACCESS_KEY = "ua_access_token";
const REFRESH_KEY = "ua_refresh_token";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/**
 * Refresh the access token. Works two ways:
 *  - with a refresh token from localStorage (single-app / no cookie), or
 *  - purely from the shared `Domain=.<parent>` SSO cookie, when localStorage is
 *    empty — this is what lets a freshly-opened app under the same parent domain
 *    obtain a session without a login screen.
 */
export async function tryRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const refreshToken = tokenStore.refresh;
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as AuthResponse;
      tokenStore.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Skip attaching the bearer token (used for login). */
  anonymous?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const url = new URL(path, window.location.origin);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (!options.anonymous && tokenStore.access) {
      headers["authorization"] = `Bearer ${tokenStore.access}`;
    }
    return fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      credentials: "include",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  };

  let res = await doFetch();
  if (res.status === 401 && !options.anonymous && (await tryRefresh())) {
    res = await doFetch();
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data.error ?? data.message ?? message;
    } catch {
      /* ignore */
    }
    if (res.status === 401) tokenStore.clear();
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
