import { eq, sql } from "drizzle-orm";

import { apps, database, users } from ".";
import { env } from "../env";
import { logger } from "../lib/logger";
import { hashPassword } from "../lib/password";

/**
 * Idempotent bootstrap run on every server start:
 *  - Creates the super-admin from BOOTSTRAP_ADMIN_* if no users exist yet.
 *  - Registers the known downstream apps if they aren't registered.
 */
export async function runBootstrap(): Promise<void> {
  const [countRow] = await database.select({ count: sql<number>`count(*)::int` }).from(users);

  if ((countRow?.count ?? 0) === 0) {
    const email = env.bootstrapAdminEmail.toLowerCase().trim();
    await database.insert(users).values({
      email,
      passwordHash: await hashPassword(env.bootstrapAdminPassword),
      displayName: "Super Admin",
      role: "superadmin",
    });
    logger.warn(`Created bootstrap super-admin ${email}. Change the password immediately.`);
  }

  await ensureApp({
    slug: "file-sync",
    name: "File Sync",
    description: "Cross-device file synchronisation.",
    availableRoles: ["user", "admin"],
    availablePermissions: ["devices:read", "devices:write", "sync:read", "sync:write"],
  });
  await ensureApp({
    slug: "ford-focus-checklist",
    name: "Ford Focus Checklist",
    description: "Vehicle inspection checklists.",
    availableRoles: ["user", "admin"],
    availablePermissions: ["checklists:read", "checklists:write", "progress:write"],
  });
}

async function ensureApp(input: {
  slug: string;
  name: string;
  description: string;
  availableRoles: string[];
  availablePermissions: string[];
}): Promise<void> {
  const [existing] = await database.select({ id: apps.id }).from(apps).where(eq(apps.slug, input.slug)).limit(1);
  if (existing) return;
  await database.insert(apps).values(input);
  logger.info(`Registered app "${input.slug}".`);
}

// Allow running directly: `bun run src/db/seed.ts`
if (import.meta.main) {
  runBootstrap()
    .then(() => {
      logger.info("Bootstrap complete.");
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ err: error }, "Bootstrap failed");
      process.exit(1);
    });
}
