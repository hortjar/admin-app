import type { AccessTokenClaims } from "@universal-admin/shared";
import { createRemoteJWKSet, jwtVerify } from "jose";

import type { UniversalAuthConfig } from "./config.js";

export interface UniversalUser {
  id: string;
  email: string;
  /** Global role on the universal server. */
  role: string;
  /** Roles this user holds in *this* app. */
  roles: string[];
  /** Permissions this user holds in *this* app. */
  permissions: string[];
  raw: AccessTokenClaims;
}

/**
 * Builds a token verifier bound to the universal server's JWKS. Verification is
 * fully local after the first key fetch (jose caches + refreshes the JWKS), so
 * an app's own routes keep working with no per-request round trip to the IdP.
 */
export function createVerifier(config: UniversalAuthConfig) {
  const jwks = createRemoteJWKSet(new URL(`${config.serverUrl}/.well-known/jwks.json`));

  return async function verify(token: string): Promise<UniversalUser | null> {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: config.issuer ?? config.serverUrl,
        audience: config.app,
      });
      const claims = payload as unknown as AccessTokenClaims;
      const grant = claims.apps?.find((a) => a.app === config.app);
      return {
        id: claims.sub,
        email: claims.email,
        role: claims.role,
        roles: grant?.roles ?? [],
        permissions: grant?.permissions ?? [],
        raw: claims,
      };
    } catch {
      return null;
    }
  };
}

/** Optional live revocation check via the introspection endpoint. */
export async function introspect(
  config: UniversalAuthConfig,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${config.serverUrl}/oauth/introspect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { active: boolean };
    return data.active === true;
  } catch {
    return false;
  }
}
