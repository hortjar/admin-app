import type { AppGrant } from "@universal-admin/shared";
import { eq } from "drizzle-orm";

import { apps, database, memberships, type UserRow } from "../db";

/**
 * Compute the per-app grants for a user, optionally narrowed to one audience app.
 * Superadmins/admins implicitly get every declared role of the target app so the
 * admin console can act on any app without an explicit membership row.
 */
export async function computeGrants(
  user: UserRow,
  audienceSlug?: string,
): Promise<AppGrant[]> {
  const rows = await database
    .select({
      slug: apps.slug,
      roles: memberships.roles,
      permissions: memberships.permissions,
    })
    .from(memberships)
    .innerJoin(apps, eq(memberships.appId, apps.id))
    .where(eq(memberships.userId, user.id));

  let grants: AppGrant[] = rows.map((r) => ({
    app: r.slug,
    roles: r.roles,
    permissions: r.permissions,
  }));

  if (audienceSlug) {
    grants = grants.filter((g) => g.app === audienceSlug);

    // Elevate admins to full access for the requested app even without a row.
    if (grants.length === 0 && (user.role === "superadmin" || user.role === "admin")) {
      const [app] = await database
        .select()
        .from(apps)
        .where(eq(apps.slug, audienceSlug))
        .limit(1);
      if (app) {
        grants = [
          { app: app.slug, roles: app.availableRoles, permissions: app.availablePermissions },
        ];
      }
    }
  }

  return grants;
}
