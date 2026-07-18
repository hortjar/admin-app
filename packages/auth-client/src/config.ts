export type AuthMode = "local" | "universal";

export interface UniversalAuthConfig {
  /** Which auth backend this app uses. */
  mode: AuthMode;
  /** Base URL of the universal server, e.g. http://localhost:9000. */
  serverUrl: string;
  /** This app's slug — the expected token audience. */
  app: string;
  /** Expected issuer (defaults to serverUrl). */
  issuer?: string;
  /** API key used for log shipping + introspection. */
  apiKey?: string;
}

/** Read config from environment with sensible names. */
export function configFromEnv(app: string): UniversalAuthConfig {
  const mode = (process.env["AUTH_MODE"] as AuthMode) === "universal" ? "universal" : "local";
  const serverUrl = process.env["UNIVERSAL_AUTH_URL"] ?? "http://localhost:9000";
  return {
    mode,
    serverUrl,
    app,
    issuer: process.env["UNIVERSAL_AUTH_ISSUER"] ?? serverUrl,
    apiKey: process.env["UNIVERSAL_AUTH_API_KEY"],
  };
}
