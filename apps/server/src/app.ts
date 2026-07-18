import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Elysia } from "elysia";

import { env } from "./env";
import { logger } from "./lib/logger";
import { authRoutes } from "./routes/auth";
import { oauthRoutes } from "./routes/oauth";
import { logIngestRoutes } from "./routes/logs-ingest";
import { healthRoutes } from "./routes/health";
import { adminUserRoutes } from "./routes/admin/users";
import { adminAppRoutes } from "./routes/admin/apps";
import { adminLogRoutes } from "./routes/admin/logs";
import { adminAuditRoutes } from "./routes/admin/audit";
import { adminSessionRoutes } from "./routes/admin/sessions";
import { adminStatsRoutes } from "./routes/admin/stats";

export function buildApp() {
  const app = new Elysia()
    .onError(({ code, error, set }) => {
      if (code === "VALIDATION") {
        set.status = 400;
        return { error: "Validation failed", detail: (error as { message?: string }).message };
      }
      if (code === "NOT_FOUND") {
        set.status = 404;
        return { error: "Not found" };
      }
      logger.error({ code, err: error }, "Unhandled error");
      set.status = 500;
      return { error: "Internal server error" };
    })
    .use(
      cors({
        origin: env.corsOrigins.length ? env.corsOrigins : true,
        credentials: true,
      }),
    )
    .use(
      openapi({
        path: "/openapi",
        documentation: {
          info: { title: "Universal Admin & Auth API", version: "0.1.0" },
          servers: [{ url: env.issuer }],
        },
      }),
    )
    // Public + service surfaces
    .use(healthRoutes)
    .use(oauthRoutes)
    .use(authRoutes)
    .use(logIngestRoutes)
    // Admin console API
    .use(adminStatsRoutes)
    .use(adminUserRoutes)
    .use(adminAppRoutes)
    .use(adminLogRoutes)
    .use(adminSessionRoutes)
    .use(adminAuditRoutes);

  // Serve the built admin SPA (in production/docker) with client-side routing fallback.
  const staticDir = env.staticDir;
  if (existsSync(staticDir)) {
    app.use(staticPlugin({ assets: staticDir, prefix: "/" }));
    app.get("/*", ({ set }) => {
      set.headers["content-type"] = "text/html";
      return Bun.file(join(staticDir, "index.html"));
    });
  }

  return app;
}
