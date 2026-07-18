import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { env } from "../env";

const migrationClient = postgres(env.databaseUrl, { max: 1 });

async function main() {
  console.log("Running migrations…");
  await migrate(drizzle(migrationClient), { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations complete.");
  await migrationClient.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
