import { sql } from "drizzle-orm";
import { Elysia } from "elysia";

import { database } from "../db";

export const healthRoutes = new Elysia({ tags: ["health"] })
  .get("/health", () => ({ status: "ok", uptime: process.uptime() }), {
    detail: { summary: "Liveness probe" },
  })
  .get(
    "/ready",
    async ({ set }) => {
      try {
        await database.execute(sql`select 1`);
        return { status: "ready" };
      } catch {
        set.status = 503;
        return { status: "unavailable" };
      }
    },
    { detail: { summary: "Readiness probe (checks DB)" } },
  );
