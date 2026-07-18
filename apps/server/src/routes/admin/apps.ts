import type { ApiKeyDto } from "@universal-admin/shared";
import { desc, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { apiKeys, apps, database } from "../../db";
import { recordAudit } from "../../lib/audit";
import { generateApiKey } from "../../lib/crypto";
import { toAppDto } from "../../lib/mappers";
import { adminAuth } from "../../middleware/auth";

const Error = t.Object({ error: t.String() });

function toApiKeyDto(row: typeof apiKeys.$inferSelect): ApiKeyDto {
  return {
    id: row.id,
    appId: row.appId,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

export const adminAppRoutes = new Elysia({ prefix: "/api/admin/apps", tags: ["admin:apps"] })
  .use(adminAuth)
  .get(
    "/",
    async () => {
      const rows = await database.select().from(apps).orderBy(desc(apps.createdAt));
      return rows.map(toAppDto);
    },
    { requireAdmin: true, response: { 200: t.Any() }, detail: { summary: "List apps" } },
  )
  .post(
    "/",
    async ({ body, admin, set }) => {
      const slug = body.slug.toLowerCase().trim();
      const [existing] = await database.select({ id: apps.id }).from(apps).where(eq(apps.slug, slug)).limit(1);
      if (existing) {
        set.status = 409;
        return { error: "Slug already in use" };
      }
      const [app] = await database
        .insert(apps)
        .values({
          slug,
          name: body.name,
          description: body.description ?? null,
          allowedOrigins: body.allowedOrigins ?? [],
          availableRoles: body.availableRoles ?? [],
          availablePermissions: body.availablePermissions ?? [],
        })
        .returning();
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.app.create", targetType: "app", targetId: app!.id, metadata: { slug } });
      return toAppDto(app!);
    },
    {
      requireAdmin: true,
      body: t.Object({
        slug: t.String({ minLength: 2 }),
        name: t.String(),
        description: t.Optional(t.String()),
        allowedOrigins: t.Optional(t.Array(t.String())),
        availableRoles: t.Optional(t.Array(t.String())),
        availablePermissions: t.Optional(t.Array(t.String())),
      }),
      response: { 200: t.Any(), 409: Error },
      detail: { summary: "Register a new app" },
    },
  )
  .patch(
    "/:id",
    async ({ params, body, admin, set }) => {
      const [app] = await database
        .update(apps)
        .set({ ...body })
        .where(eq(apps.id, params.id))
        .returning();
      if (!app) {
        set.status = 404;
        return { error: "Not found" };
      }
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.app.update", targetType: "app", targetId: app.id });
      return toAppDto(app);
    },
    {
      requireAdmin: true,
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        allowedOrigins: t.Optional(t.Array(t.String())),
        availableRoles: t.Optional(t.Array(t.String())),
        availablePermissions: t.Optional(t.Array(t.String())),
        disabled: t.Optional(t.Boolean()),
      }),
      response: { 200: t.Any(), 404: Error },
      detail: { summary: "Update an app" },
    },
  )
  .delete(
    "/:id",
    async ({ params, admin }) => {
      await database.delete(apps).where(eq(apps.id, params.id));
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.app.delete", targetType: "app", targetId: params.id });
      return { ok: true };
    },
    { requireSuperadmin: true, response: { 200: t.Object({ ok: t.Boolean() }) }, detail: { summary: "Delete an app (superadmin)" } },
  )
  // ─── API keys ────────────────────────────────────────────────────────────────
  .get(
    "/:id/keys",
    async ({ params }) => {
      const rows = await database
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.appId, params.id))
        .orderBy(desc(apiKeys.createdAt));
      return rows.map(toApiKeyDto);
    },
    { requireAdmin: true, response: { 200: t.Any() }, detail: { summary: "List an app's API keys" } },
  )
  .post(
    "/:id/keys",
    async ({ params, body, admin, set }) => {
      const [app] = await database.select().from(apps).where(eq(apps.id, params.id)).limit(1);
      if (!app) {
        set.status = 404;
        return { error: "App not found" };
      }
      const { raw, prefix, hash } = generateApiKey();
      const [row] = await database
        .insert(apiKeys)
        .values({ appId: params.id, name: body.name, prefix, keyHash: hash })
        .returning();
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.apikey.create", targetType: "app", targetId: app.id, metadata: { name: body.name } });
      // The raw key is returned exactly once.
      return { ...toApiKeyDto(row!), key: raw };
    },
    {
      requireAdmin: true,
      body: t.Object({ name: t.String() }),
      response: { 200: t.Any(), 404: Error },
      detail: { summary: "Create an API key (raw value returned once)" },
    },
  )
  .delete(
    "/:id/keys/:keyId",
    async ({ params, admin }) => {
      await database
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(eq(apiKeys.id, params.keyId));
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.apikey.revoke", targetType: "apikey", targetId: params.keyId });
      return { ok: true };
    },
    { requireAdmin: true, response: { 200: t.Object({ ok: t.Boolean() }) }, detail: { summary: "Revoke an API key" } },
  );
