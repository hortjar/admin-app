import { desc, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { auditLogs, database } from "../../db";
import { toAuditDto } from "../../lib/mappers";
import { adminAuth } from "../../middleware/auth";

export const adminAuditRoutes = new Elysia({ prefix: "/api/admin/audit", tags: ["admin:audit"] })
  .use(adminAuth)
  .get(
    "/",
    async ({ query }) => {
      const limit = Math.min(query.limit ?? 100, 500);
      const offset = query.offset ?? 0;
      const rows = await database
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);
      const [countRow] = await database
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs);
      return { items: rows.map(toAuditDto), total: countRow?.count ?? 0, limit, offset };
    },
    {
      requireAdmin: true,
      query: t.Object({ limit: t.Optional(t.Number()), offset: t.Optional(t.Number()) }),
      response: { 200: t.Any() },
      detail: { summary: "List audit log entries" },
    },
  );
