import { LOG_LEVELS } from "@universal-admin/shared";
import { and, desc, eq, gte, ilike, inArray, lte, sql, type SQL } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { database, logs } from "../../db";
import { toLogDto } from "../../lib/mappers";
import { adminAuth } from "../../middleware/auth";

export const adminLogRoutes = new Elysia({ prefix: "/api/admin/logs", tags: ["admin:logs"] })
  .use(adminAuth)
  .get(
    "/",
    async ({ query }) => {
      const conditions: SQL[] = [];
      if (query.app) conditions.push(eq(logs.app, query.app));
      if (query.level) conditions.push(inArray(logs.level, query.level.split(",")));
      if (query.search) conditions.push(ilike(logs.message, `%${query.search}%`));
      if (query.from) conditions.push(gte(logs.timestamp, new Date(query.from)));
      if (query.to) conditions.push(lte(logs.timestamp, new Date(query.to)));
      if (query.userId) conditions.push(eq(logs.userId, query.userId));

      const where = conditions.length ? and(...conditions) : undefined;
      const limit = Math.min(query.limit ?? 100, 500);
      const offset = query.offset ?? 0;

      const rows = await database
        .select()
        .from(logs)
        .where(where)
        .orderBy(desc(logs.timestamp))
        .limit(limit)
        .offset(offset);

      const [countRow] = await database
        .select({ count: sql<number>`count(*)::int` })
        .from(logs)
        .where(where);

      return { items: rows.map(toLogDto), total: countRow?.count ?? 0, limit, offset };
    },
    {
      requireAdmin: true,
      query: t.Object({
        app: t.Optional(t.String()),
        level: t.Optional(t.String()),
        search: t.Optional(t.String()),
        userId: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        limit: t.Optional(t.Number()),
        offset: t.Optional(t.Number()),
      }),
      response: { 200: t.Any() },
      detail: { summary: "Query ingested logs with filters" },
    },
  )
  .get(
    "/facets",
    async () => {
      const apps = await database
        .select({ app: logs.app, count: sql<number>`count(*)::int` })
        .from(logs)
        .groupBy(logs.app);
      return { apps, levels: LOG_LEVELS };
    },
    { requireAdmin: true, response: { 200: t.Any() }, detail: { summary: "Log filter facets" } },
  )
  .delete(
    "/",
    async ({ query }) => {
      // Retention cleanup: delete logs older than the given ISO timestamp.
      if (!query.before) return { deleted: 0 };
      const deleted = await database
        .delete(logs)
        .where(lte(logs.timestamp, new Date(query.before)))
        .returning({ id: logs.id });
      return { deleted: deleted.length };
    },
    {
      requireSuperadmin: true,
      query: t.Object({ before: t.Optional(t.String()) }),
      response: { 200: t.Object({ deleted: t.Number() }) },
      detail: { summary: "Purge logs before a timestamp (superadmin)" },
    },
  );
