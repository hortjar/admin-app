import { and, desc, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { database, sessions } from "../../db";
import { recordAudit } from "../../lib/audit";
import { toSessionDto } from "../../lib/mappers";
import { adminAuth } from "../../middleware/auth";

export const adminSessionRoutes = new Elysia({
  prefix: "/api/admin/sessions",
  tags: ["admin:sessions"],
})
  .use(adminAuth)
  .get(
    "/",
    async ({ query }) => {
      const conditions = [isNull(sessions.revokedAt)];
      if (query.userId) conditions.push(eq(sessions.userId, query.userId));
      const rows = await database
        .select()
        .from(sessions)
        .where(and(...conditions))
        .orderBy(desc(sessions.createdAt))
        .limit(200);
      return rows.map((s) => toSessionDto(s));
    },
    {
      requireAdmin: true,
      query: t.Object({ userId: t.Optional(t.String()) }),
      response: { 200: t.Any() },
      detail: { summary: "List active sessions" },
    },
  )
  .delete(
    "/:id",
    async ({ params, admin }) => {
      await database
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, params.id));
      recordAudit({ actorId: admin!.id, actorEmail: admin!.email, action: "admin.session.revoke", targetType: "session", targetId: params.id });
      return { ok: true };
    },
    { requireAdmin: true, response: { 200: t.Object({ ok: t.Boolean() }) }, detail: { summary: "Revoke a session" } },
  );
