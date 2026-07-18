import type { AccessTokenClaims, AppGrant, GlobalRole } from "@universal-admin/shared";
import { jwtVerify, SignJWT } from "jose";

import { env } from "../env";
import { getKeys, getLocalJwkSet, SIGNING_ALG } from "./keys";

export interface SignAccessTokenInput {
  userId: string;
  email: string;
  role: GlobalRole;
  /** Audience app slug(s). Use "admin" for the admin console token. */
  audience: string | string[];
  apps: AppGrant[];
}

/** Sign an RS256 access token verifiable by downstream apps via JWKS. */
export async function signAccessToken(input: SignAccessTokenInput): Promise<{
  token: string;
  expiresIn: number;
  jti: string;
}> {
  const { active } = await getKeys();
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    email: input.email,
    role: input.role,
    apps: input.apps,
    typ: "access",
  })
    .setProtectedHeader({ alg: SIGNING_ALG, kid: active.kid, typ: "JWT" })
    .setIssuer(env.issuer)
    .setSubject(input.userId)
    .setAudience(input.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + env.accessTokenTtl)
    .setJti(jti)
    .sign(active.privateKey);

  return { token, expiresIn: env.accessTokenTtl, jti };
}

/** Verify a token issued by this server (used by /introspect and admin auth). */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const jwks = await getLocalJwkSet();
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.issuer,
    });
    return payload as unknown as AccessTokenClaims;
  } catch {
    return null;
  }
}
