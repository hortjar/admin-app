import { Elysia } from "elysia";

import type { UniversalAuthConfig } from "./config.js";
import { createVerifier, type UniversalUser } from "./verify.js";

/**
 * Elysia plugin that verifies universal-server access tokens for this app.
 *
 * It mirrors the macro shape the downstream apps already use so routes need no
 * changes: it derives `universalUser` and exposes a `requireUniversal` macro.
 * Apps select between their local plugin and this one based on AUTH_MODE, so a
 * universal-issued token validates here while every other route keeps working.
 */
export function universalAuthPlugin(config: UniversalAuthConfig) {
  const verify = createVerifier(config);

  return new Elysia({ name: "universal-auth" })
    .derive({ as: "global" }, async ({ headers }) => {
      const header = headers["authorization"];
      if (!header?.startsWith("Bearer ")) {
        return { universalUser: null as UniversalUser | null };
      }
      return { universalUser: await verify(header.slice(7)) };
    })
    .macro({
      requireUniversal: {
        beforeHandle({ universalUser, set }: { universalUser: UniversalUser | null; set: { status?: number | string } }) {
          if (!universalUser) {
            set.status = 401;
            return { error: "Unauthorized" };
          }
        },
      },
    });
}
