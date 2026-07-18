import type { Cookie } from "elysia";

import { env } from "../env";

/** Elysia's cookie jar as handed to route handlers via the `cookie` context. */
export type CookieJar = Record<string, Cookie<unknown>>;

/**
 * Set the shared refresh-token cookie. Scoped to COOKIE_DOMAIN so every app
 * under it (e.g. *.hortjar.cz) can silently refresh a session. HttpOnly so it's
 * never readable by JavaScript (XSS-safe).
 */
export function setRefreshCookie(cookie: CookieJar, token: string): void {
  if (!env.cookies.enabled) return;
  cookie[env.cookies.name]?.set({
    value: token,
    httpOnly: true,
    secure: env.cookies.secure,
    sameSite: env.cookies.sameSite,
    domain: env.cookies.domain,
    path: "/",
    maxAge: env.refreshTokenTtl,
  });
}

/** Clear the shared refresh cookie (logout). */
export function clearRefreshCookie(cookie: CookieJar): void {
  if (!env.cookies.enabled) return;
  cookie[env.cookies.name]?.set({
    value: "",
    httpOnly: true,
    secure: env.cookies.secure,
    sameSite: env.cookies.sameSite,
    domain: env.cookies.domain,
    path: "/",
    maxAge: 0,
  });
}

/** Read the refresh token from the shared cookie, if present. */
export function readRefreshCookie(cookie: CookieJar): string | undefined {
  const value = cookie[env.cookies.name]?.value;
  return typeof value === "string" && value ? value : undefined;
}
