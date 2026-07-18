import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { apps, database, users } from "../db";
import { recordAudit } from "../lib/audit";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "../lib/cookies";
import { hashPassword, verifyPassword } from "../lib/password";
import { toUserDto } from "../lib/mappers";
import { computeGrants } from "../services/grants";
import { issueSession, revokeSession, rotateSession } from "../services/sessions";
import { adminAuth } from "../middleware/auth";

const AuthResponse = t.Object({
  user: t.Any(),
  accessToken: t.String(),
  refreshToken: t.String(),
  expiresIn: t.Number(),
  tokenType: t.Literal("Bearer"),
});

const Error = t.Object({ error: t.String() });

/** Resolve + validate the requested audience app slug. Defaults to "admin". */
async function resolveAudience(slug: string | undefined): Promise<string | null> {
  const audience = (slug ?? "admin").trim();
  if (audience === "admin") return "admin";
  const [app] = await database
    .select({ slug: apps.slug, disabled: apps.disabled })
    .from(apps)
    .where(eq(apps.slug, audience))
    .limit(1);
  if (!app || app.disabled) return null;
  return app.slug;
}

/**
 * End-user identity endpoints. These are what downstream apps (and the admin
 * console) call. The `app` field selects the token audience so the issued token
 * carries that app's grants and is scoped to it.
 */
export const authRoutes = new Elysia({ prefix: "/api/auth", tags: ["auth"] })
  .use(adminAuth)
  .post(
    "/register",
    async ({ body, headers, server, request, set, cookie }) => {
      const audience = await resolveAudience(body.app);
      if (!audience) {
        set.status = 400;
        return { error: "Unknown or disabled app" };
      }

      const email = body.email.toLowerCase().trim();
      const [existing] = await database
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (existing) {
        set.status = 409;
        return { error: "An account with that email already exists." };
      }

      const [user] = await database
        .insert(users)
        .values({ email, passwordHash: await hashPassword(body.password), displayName: body.displayName ?? null })
        .returning();
      if (!user) {
        set.status = 500;
        return { error: "Failed to create user" };
      }

      recordAudit({ actorId: user.id, actorEmail: email, action: "user.register", targetType: "user", targetId: user.id, metadata: { app: audience } });
      const session = await issueSession(user, {
        audience,
        userAgent: headers["user-agent"],
        ip: server?.requestIP(request)?.address ?? null,
      });
      setRefreshCookie(cookie, session.refreshToken);
      return session;
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8 }),
        displayName: t.Optional(t.String()),
        app: t.Optional(t.String()),
      }),
      response: { 200: AuthResponse, 400: Error, 409: Error, 500: Error },
      detail: { summary: "Register a new user for an app" },
    },
  )
  .post(
    "/login",
    async ({ body, headers, server, request, set, cookie }) => {
      const audience = await resolveAudience(body.app);
      if (!audience) {
        set.status = 400;
        return { error: "Unknown or disabled app" };
      }

      const email = body.email.toLowerCase().trim();
      const [user] = await database.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
        set.status = 401;
        return { error: "Invalid email or password." };
      }
      if (user.disabled) {
        set.status = 403;
        return { error: "Account is disabled." };
      }

      await database.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      recordAudit({ actorId: user.id, actorEmail: email, action: "user.login", metadata: { app: audience } });
      const session = await issueSession(user, {
        audience,
        userAgent: headers["user-agent"],
        ip: server?.requestIP(request)?.address ?? null,
      });
      setRefreshCookie(cookie, session.refreshToken);
      return session;
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
        app: t.Optional(t.String()),
      }),
      response: { 200: AuthResponse, 400: Error, 401: Error, 403: Error },
      detail: { summary: "Log in and receive an access + refresh token pair" },
    },
  )
  .post(
    "/refresh",
    async ({ body, headers, server, request, set, cookie }) => {
      // Accept the refresh token from the JSON body (localStorage clients) or the
      // shared SSO cookie (cross-subdomain silent refresh).
      const token = body.refreshToken ?? readRefreshCookie(cookie);
      if (!token) {
        set.status = 401;
        return { error: "No refresh token provided." };
      }
      const rotated = await rotateSession(token, {
        userAgent: headers["user-agent"],
        ip: server?.requestIP(request)?.address ?? null,
      });
      if (!rotated) {
        set.status = 401;
        clearRefreshCookie(cookie);
        return { error: "Invalid or expired refresh token." };
      }
      setRefreshCookie(cookie, rotated.refreshToken);
      return rotated;
    },
    {
      body: t.Object({ refreshToken: t.Optional(t.String()) }),
      response: { 200: AuthResponse, 401: Error },
      detail: { summary: "Exchange a refresh token (body or cookie) for a new token pair" },
    },
  )
  .post(
    "/logout",
    async ({ body, cookie }) => {
      const token = body.refreshToken ?? readRefreshCookie(cookie);
      if (token) await revokeSession(token);
      clearRefreshCookie(cookie);
      return { error: "" };
    },
    {
      body: t.Object({ refreshToken: t.Optional(t.String()) }),
      response: { 200: Error },
      detail: { summary: "Revoke a refresh token and clear the SSO cookie" },
    },
  )
  .get(
    "/me",
    async ({ admin, query, set }) => {
      if (!admin) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const [user] = await database.select().from(users).where(eq(users.id, admin.id)).limit(1);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      const grants = await computeGrants(user, query.app);
      return toUserDto(user, grants);
    },
    {
      query: t.Object({ app: t.Optional(t.String()) }),
      response: { 200: t.Any(), 401: Error },
      detail: { summary: "Get the current authenticated user + grants" },
    },
  );
