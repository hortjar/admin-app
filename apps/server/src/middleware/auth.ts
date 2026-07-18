import { isAdminRole } from "@universal-admin/shared";
import { and, eq, isNull } from "drizzle-orm";
import { Elysia } from "elysia";

import { apiKeys, apps, database } from "../db";
import { sha256 } from "../lib/crypto";
import { verifyAccessToken } from "../lib/jwt";

export interface AdminContextUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Admin auth plugin. Verifies the universal server's own access token and
 * exposes `admin` (context user) plus two macros:
 *  - `requireAdmin` → 401 if not authenticated, 403 if not an admin role.
 *  - `requireSuperadmin` → additionally requires the superadmin role.
 */
export const adminAuth = new Elysia({ name: "admin-auth" })
  .derive({ as: "global" }, async ({ headers }) => {
    const header = headers["authorization"];
    if (!header?.startsWith("Bearer ")) return { admin: null as AdminContextUser | null };
    const claims = await verifyAccessToken(header.slice(7));
    if (!claims) return { admin: null as AdminContextUser | null };
    return {
      admin: { id: claims.sub, email: claims.email, role: claims.role } as AdminContextUser,
    };
  })
  .macro({
    requireAdmin: {
      beforeHandle({ admin, set }) {
        if (!admin) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        if (!isAdminRole(admin.role)) {
          set.status = 403;
          return { error: "Forbidden" };
        }
      },
    },
    requireSuperadmin: {
      beforeHandle({ admin, set }) {
        if (!admin) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        if (admin.role !== "superadmin") {
          set.status = 403;
          return { error: "Superadmin required" };
        }
      },
    },
  });

/**
 * API-key auth for service-to-service endpoints (log ingestion, introspection).
 * Resolves the calling app from a `uak_...` key in the `x-api-key` header.
 */
export const apiKeyAuth = new Elysia({ name: "api-key-auth" })
  .derive({ as: "global" }, async ({ headers }) => {
    const raw = headers["x-api-key"];
    if (!raw) return { callerApp: null as { id: string; slug: string } | null };

    const hash = sha256(raw);
    const [key] = await database
      .select({ id: apiKeys.id, appId: apiKeys.appId })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
      .limit(1);
    if (!key) return { callerApp: null as { id: string; slug: string } | null };

    const [app] = await database
      .select({ id: apps.id, slug: apps.slug, disabled: apps.disabled })
      .from(apps)
      .where(eq(apps.id, key.appId))
      .limit(1);
    if (!app || app.disabled) return { callerApp: null as { id: string; slug: string } | null };

    // Best-effort last-used stamp.
    database
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
      .catch(() => {});

    return { callerApp: { id: app.id, slug: app.slug } };
  })
  .macro({
    requireApiKey: {
      beforeHandle({ callerApp, set }) {
        if (!callerApp) {
          set.status = 401;
          return { error: "Invalid or missing API key" };
        }
      },
    },
  });
