import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { env } from "../env";

const migrationClient = postgres(env.databaseUrl, { max: 1 });

// Resolve relative to this file so it works regardless of the process CWD
// (e.g. `pnpm migrate` from apps/server, or `bun …` from /app in Docker).
const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

async function main() {
  console.log("Running migrations…");
  await migrate(drizzle(migrationClient), { migrationsFolder });
  console.log("Migrations complete.");
  await migrationClient.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
