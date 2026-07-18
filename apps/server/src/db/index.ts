import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../env";
import * as schema from "./schema";

const client = postgres(env.databaseUrl, { max: 10 });

export const database = drizzle(client, { schema });
export { client as sql };
export * from "./schema";
