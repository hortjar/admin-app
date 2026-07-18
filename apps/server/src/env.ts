function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is required`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: Number(optional("PORT", "9000")),
  issuer: optional("ISSUER", "http://localhost:9000"),
  databaseUrl: required("DATABASE_URL"),
  corsOrigins: optional("CORS_ORIGINS", "http://localhost:9000,http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  signingKeyPemBase64: process.env["SIGNING_KEY_PEM_BASE64"] ?? null,
  accessTokenTtl: Number(optional("ACCESS_TOKEN_TTL", "900")),
  refreshTokenTtl: Number(optional("REFRESH_TOKEN_TTL", "2592000")),
  bootstrapAdminEmail: optional("BOOTSTRAP_ADMIN_EMAIL", "admin@example.com"),
  bootstrapAdminPassword: optional("BOOTSTRAP_ADMIN_PASSWORD", "change-me-now"),
  /** Directory the built admin SPA is copied to in the Docker image. */
  staticDir: optional("STATIC_DIR", "./public"),
  nodeEnv: optional("NODE_ENV", "development"),

  // ─── Cross-subdomain SSO cookie ──────────────────────────────────────────────
  // When enabled, the refresh token is also set as an HttpOnly cookie so every
  // app under COOKIE_DOMAIN can silently obtain a session (log in once).
  cookies: {
    enabled: optional("ENABLE_AUTH_COOKIES", "true") !== "false",
    /** e.g. ".hortjar.cz" to share across *.hortjar.cz. Empty = host-only cookie. */
    domain: process.env["COOKIE_DOMAIN"] || undefined,
    name: optional("COOKIE_REFRESH_NAME", "ua_refresh"),
    /** Secure cookies require HTTPS; default on in production. */
    secure: optional("COOKIE_SECURE", process.env["NODE_ENV"] === "production" ? "true" : "false") !== "false",
    /** "lax" works for same-site subdomains; "none" needed for cross-site (requires Secure). */
    sameSite: optional("COOKIE_SAMESITE", "lax") as "lax" | "strict" | "none",
  },
} as const;

export const isProduction = env.nodeEnv === "production";
