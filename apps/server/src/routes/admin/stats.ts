import { gte, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { apps, auditLogs, database, logs, sessions, users } from "../../db";
import { adminAuth } from "../../middleware/auth";

export const adminStatsRoutes = new Elysia({ prefix: "/api/admin/stats", tags: ["admin:stats"] })
  .use(adminAuth)
  .get(
    "/",
    async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [[u], [a], [s], [l24], [errs]] = await Promise.all([
        database.select({ n: sql<number>`count(*)::int` }).from(users),
        database.select({ n: sql<number>`count(*)::int` }).from(apps),
        database
          .select({ n: sql<number>`count(*)::int` })
          .from(sessions)
          .where(sql`revoked_at is null and expires_at > now()`),
        database.select({ n: sql<number>`count(*)::int` }).from(logs).where(gte(logs.timestamp, since)),
        database
          .select({ n: sql<number>`count(*)::int` })
          .from(logs)
          .where(sql`level in ('error','fatal') and timestamp >= ${since.toISOString()}`),
      ]);

      // Logs per level in the last 24h, grouped by app.
      const byLevel = await database
        .select({ app: logs.app, level: logs.level, count: sql<number>`count(*)::int` })
        .from(logs)
        .where(gte(logs.timestamp, since))
        .groupBy(logs.app, logs.level);

      const recentAudit = await database
        .select()
        .from(auditLogs)
        .orderBy(sql`created_at desc`)
        .limit(10);

      return {
        users: u?.n ?? 0,
        apps: a?.n ?? 0,
        activeSessions: s?.n ?? 0,
        logs24h: l24?.n ?? 0,
        errors24h: errs?.n ?? 0,
        logsByLevel: byLevel,
        recentAudit,
      };
    },
    { requireAdmin: true, response: { 200: t.Any() }, detail: { summary: "Dashboard statistics" } },
  );
