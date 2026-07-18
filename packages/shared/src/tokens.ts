import type { AppGrant } from "./permissions.js";
import type { GlobalRole } from "./roles.js";

/**
 * The claims carried by an access token issued by the universal server.
 * Signed RS256; verifiable by any downstream app via the JWKS endpoint.
 */
export interface AccessTokenClaims {
  iss: string;
  sub: string;
  /** Audience — the app slug(s) this token is valid for. */
  aud: string | string[];
  email: string;
  /** Global role on the universal server. */
  role: GlobalRole;
  /** Per-app grants (roles + permissions), keyed for the audience app(s). */
  apps: AppGrant[];
  iat: number;
  exp: number;
  /** Token type marker. */
  typ: "access";
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}
