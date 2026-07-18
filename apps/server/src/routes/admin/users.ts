import { GLOBAL_ROLES } from "@universal-admin/shared";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { apps, database, memberships, users } from "../../db";
import { recordAudit } from "../../lib/audit";
import { toUserDto } from "../../lib/mappers";
import { hashPassword } from "../../lib/password";
import { computeGrants } from "../../services/grants";
import { revokeAllSessions } from "../../services/sessions";
import { adminAuth } from "../../middleware/auth";

const Error = t.Object({ error: t.String() });

export const adminUserRoutes = new Elysia({ prefix: "/api/admin/users", tags: ["admin:users"] })
  .use(adminAuth)
  .get(
    "/",
    async ({ query }) => {
      const search = query.search?.trim();
      const limit = Math.min(query.limit ?? 50, 200);
      const offset = query.offset ?? 0;
      const where = search
        ? or(ilike(users.email, `%${search}%`), ilike(users.displayName, `%${search}%`))
        : undefined;

      const rows = await database
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      const [countRow] = await database
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(where);

      const dtos = await Promise.all(rows.map(async (u) => toUserDto(u, await computeGrants(u))));
      return { items: dtos, total: countRow?.count ?? 0, limit, offset };
    },
    {
      requireAdmin: true,
      query: t.Object({
        search: t.Optional(t.String()),
        limit: t.Optional(t.Number()),
        offset: t.Optional(t.Number()),
      }),
      response: { 200: t.Any() },
      detail: { summary: "List users" },
    },
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const [user] = await database.select().from(users).where(eq(users.id, params.id)).limit(1);
      if (!user) {
        set.status = 404;
        return { error: "Not found" };
      }
      return toUserDto(user, await computeGrants(user));
    },
    { requireAdmin: true, response: { 200: t.Any(), 404: Error }, detail: { summary: "Get a user" } },
  )
  .post(
    "/",
    async ({ body, admin, set }) => {
      const email = body.email.toLowerCase().trim();
      const [existing] = await database
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (existing) {
        set.status = 409;
        return { error: "Email already registered" };
      }
      const [user] = await database
        .insert(users)
        .values({
          email,
          passwordHash: await hashPassword(body.password),
          displayName: body.displayName ?? null,
          role: body.role ?? "user",
        })
        .returning();
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.user.create", targetType: "user", targetId: user!.id });
      return toUserDto(user!, []);
    },
    {
      requireAdmin: true,
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8 }),
        displayName: t.Optional(t.String()),
        role: t.Optional(t.Union(GLOBAL_ROLES.map((r) => t.Literal(r)))),
      }),
      response: { 200: t.Any(), 409: Error },
      detail: { summary: "Create a user" },
    },
  )
  .patch(
    "/:id",
    async ({ params, body, admin, set }) => {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (body.displayName !== undefined) patch.displayName = body.displayName;
      if (body.role !== undefined) patch.role = body.role;
      if (body.disabled !== undefined) patch.disabled = body.disabled;

      const [user] = await database.update(users).set(patch).where(eq(users.id, params.id)).returning();
      if (!user) {
        set.status = 404;
        return { error: "Not found" };
      }
      if (body.disabled === true) await revokeAllSessions(user.id);
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.user.update", targetType: "user", targetId: user.id, metadata: body });
      return toUserDto(user, await computeGrants(user));
    },
    {
      requireAdmin: true,
      body: t.Object({
        displayName: t.Optional(t.String()),
        role: t.Optional(t.Union(GLOBAL_ROLES.map((r) => t.Literal(r)))),
        disabled: t.Optional(t.Boolean()),
      }),
      response: { 200: t.Any(), 404: Error },
      detail: { summary: "Update a user's profile / global role / disabled state" },
    },
  )
  .post(
    "/:id/reset-password",
    async ({ params, body, admin, set }) => {
      const [user] = await database
        .update(users)
        .set({ passwordHash: await hashPassword(body.password), updatedAt: new Date() })
        .where(eq(users.id, params.id))
        .returning();
      if (!user) {
        set.status = 404;
        return { error: "Not found" };
      }
      // Force re-auth everywhere after a reset.
      await revokeAllSessions(user.id);
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.user.reset_password", targetType: "user", targetId: user.id });
      return { ok: true };
    },
    {
      requireAdmin: true,
      body: t.Object({ password: t.String({ minLength: 8 }) }),
      response: { 200: t.Object({ ok: t.Boolean() }), 404: Error },
      detail: { summary: "Reset a user's password and revoke their sessions" },
    },
  )
  .post(
    "/:id/revoke-sessions",
    async ({ params, admin }) => {
      await revokeAllSessions(params.id);
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.user.revoke_sessions", targetType: "user", targetId: params.id });
      return { ok: true };
    },
    { requireAdmin: true, response: { 200: t.Object({ ok: t.Boolean() }) }, detail: { summary: "Revoke all of a user's sessions" } },
  )
  .put(
    "/:id/memberships/:appId",
    async ({ params, body, admin, set }) => {
      const [app] = await database.select().from(apps).where(eq(apps.id, params.appId)).limit(1);
      if (!app) {
        set.status = 404;
        return { error: "App not found" };
      }
      await database
        .insert(memberships)
        .values({ userId: params.id, appId: params.appId, roles: body.roles, permissions: body.permissions })
        .onConflictDoUpdate({
          target: [memberships.userId, memberships.appId],
          set: { roles: body.roles, permissions: body.permissions },
        });
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.membership.set", targetType: "user", targetId: params.id, metadata: { app: app.slug, ...body } });
      return { ok: true };
    },
    {
      requireAdmin: true,
      body: t.Object({ roles: t.Array(t.String()), permissions: t.Array(t.String()) }),
      response: { 200: t.Object({ ok: t.Boolean() }), 404: Error },
      detail: { summary: "Set a user's roles/permissions for an app" },
    },
  )
  .delete(
    "/:id/memberships/:appId",
    async ({ params, admin }) => {
      await database
        .delete(memberships)
        .where(and(eq(memberships.userId, params.id), eq(memberships.appId, params.appId)));
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.membership.remove", targetType: "user", targetId: params.id, metadata: { appId: params.appId } });
      return { ok: true };
    },
    { requireAdmin: true, response: { 200: t.Object({ ok: t.Boolean() }) }, detail: { summary: "Remove a user's membership in an app" } },
  )
  .delete(
    "/:id",
    async ({ params, admin, set }) => {
      if (params.id === admin!.id) {
        set.status = 400;
        return { error: "You cannot delete your own account." };
      }
      await database.delete(users).where(eq(users.id, params.id));
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.user.delete", targetType: "user", targetId: params.id });
      return { ok: true };
    },
    { requireSuperadmin: true, response: { 200: t.Object({ ok: t.Boolean() }), 400: Error }, detail: { summary: "Delete a user (superadmin)" } },
  );
