import { LOG_LEVELS } from "@universal-admin/shared";
import { Elysia, t } from "elysia";

import { database, logs } from "../db";
import { apiKeyAuth } from "../middleware/auth";

/**
 * Log ingestion for downstream apps. Authenticated with a per-app API key so
 * the source app is always known and can't be spoofed. Accepts a single entry
 * or a batch for efficient shipping.
 */
export const logIngestRoutes = new Elysia({ prefix: "/api/logs", tags: ["logs"] })
  .use(apiKeyAuth)
  .post(
    "/",
    async ({ body, callerApp }) => {
      const entries = Array.isArray(body) ? body : [body];
      if (entries.length === 0) return { accepted: 0 };

      await database.insert(logs).values(
        entries.map((e) => ({
          app: callerApp!.slug,
          level: e.level,
          message: e.message,
          requestId: e.requestId ?? null,
          userId: e.userId ?? null,
          context: e.context ?? null,
          timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
        })),
      );

      return { accepted: entries.length };
    },
    {
      requireApiKey: true,
      body: t.Union([LogEntrySchema(), t.Array(LogEntrySchema())]),
      response: { 200: t.Object({ accepted: t.Number() }), 401: t.Object({ error: t.String() }) },
      detail: { summary: "Ingest one or a batch of log entries (API key required)" },
    },
  );

function LogEntrySchema() {
  return t.Object({
    level: t.Union(LOG_LEVELS.map((l) => t.Literal(l))),
    message: t.String(),
    timestamp: t.Optional(t.String()),
    requestId: t.Optional(t.String()),
    userId: t.Optional(t.String()),
    context: t.Optional(t.Record(t.String(), t.Unknown())),
  });
}
