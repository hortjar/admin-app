import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { database, users } from "../db";
import { env } from "../env";
import { verifyAccessToken } from "../lib/jwt";
import { getJwks } from "../lib/keys";
import { computeGrants } from "../services/grants";

/**
 * Standards-ish discovery + validation surface. Downstream apps fetch the JWKS
 * to verify tokens locally (no per-request round trip), and can optionally call
 * /introspect to check live revocation status.
 */
export const oauthRoutes = new Elysia({ tags: ["oauth"] })
  .get(
    "/.well-known/jwks.json",
    async ({ set }) => {
      set.headers["cache-control"] = "public, max-age=3600";
      return getJwks();
    },
    { detail: { summary: "Public JSON Web Key Set for token verification" } },
  )
  .get(
    "/.well-known/openid-configuration",
    () => ({
      issuer: env.issuer,
      jwks_uri: `${env.issuer}/.well-known/jwks.json`,
      token_endpoint: `${env.issuer}/api/auth/login`,
      introspection_endpoint: `${env.issuer}/oauth/introspect`,
      userinfo_endpoint: `${env.issuer}/oauth/userinfo`,
      id_token_signing_alg_values_supported: ["RS256"],
      grant_types_supported: ["password", "refresh_token"],
    }),
    { detail: { summary: "OpenID-style discovery document" } },
  )
  .post(
    "/oauth/introspect",
    async ({ body }) => {
      const claims = await verifyAccessToken(body.token);
      if (!claims) return { active: false };
      return {
        active: true,
        sub: claims.sub,
        email: claims.email,
        role: claims.role,
        aud: claims.aud,
        apps: claims.apps,
        exp: claims.exp,
        iss: claims.iss,
      };
    },
    {
      body: t.Object({ token: t.String() }),
      detail: { summary: "RFC 7662-style token introspection" },
    },
  )
  .get(
    "/oauth/userinfo",
    async ({ headers, query, set }) => {
      const header = headers["authorization"];
      const claims = header?.startsWith("Bearer ")
        ? await verifyAccessToken(header.slice(7))
        : null;
      if (!claims) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const [user] = await database.select().from(users).where(eq(users.id, claims.sub)).limit(1);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const grants = await computeGrants(user, query.app);
      return {
        sub: user.id,
        email: user.email,
        name: user.displayName,
        role: user.role,
        apps: grants,
      };
    },
    {
      query: t.Object({ app: t.Optional(t.String()) }),
      detail: { summary: "Resolve the current user from a bearer token" },
    },
  );
