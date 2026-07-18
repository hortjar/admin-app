import type { TokenPair, UserDto } from "@universal-admin/shared";
import { and, eq, isNull } from "drizzle-orm";

import { database, sessions, type UserRow } from "../db";
import { env } from "../env";
import { randomToken, sha256 } from "../lib/crypto";
import { signAccessToken } from "../lib/jwt";
import { toUserDto } from "../lib/mappers";
import { computeGrants } from "./grants";

export interface IssueSessionOptions {
  audience: string; // app slug or "admin"
  userAgent?: string | null;
  ip?: string | null;
}

export interface IssuedSession extends TokenPair {
  user: UserDto;
}

/** Issue an access+refresh pair for a user against a given audience and store the session. */
export async function issueSession(
  user: UserRow,
  opts: IssueSessionOptions,
): Promise<IssuedSession> {
  const grants = await computeGrants(user, opts.audience === "admin" ? undefined : opts.audience);

  const { token: accessToken, expiresIn } = await signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role as UserDto["role"],
    audience: opts.audience,
    apps: grants,
  });

  const refreshToken = randomToken();
  await database.insert(sessions).values({
    userId: user.id,
    app: opts.audience === "admin" ? null : opts.audience,
    tokenHash: sha256(refreshToken),
    userAgent: opts.userAgent ?? null,
    ip: opts.ip ?? null,
    expiresAt: new Date(Date.now() + env.refreshTokenTtl * 1000),
    lastUsedAt: new Date(),
  });

  return {
    user: toUserDto(user, grants),
    accessToken,
    refreshToken,
    expiresIn,
    tokenType: "Bearer",
  };
}

/** Rotate a refresh token: validate, revoke old, issue a fresh pair. */
export async function rotateSession(
  refreshToken: string,
  opts: { userAgent?: string | null; ip?: string | null },
): Promise<IssuedSession | null> {
  const tokenHash = sha256(refreshToken);
  const [stored] = await database
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
    .limit(1);

  if (!stored || stored.expiresAt.getTime() < Date.now()) return null;

  const { users } = await import("../db");
  const [user] = await database.select().from(users).where(eq(users.id, stored.userId)).limit(1);
  if (!user || user.disabled) return null;

  // Revoke the used token (rotation).
  await database
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, stored.id));

  return issueSession(user, {
    audience: stored.app ?? "admin",
    userAgent: opts.userAgent,
    ip: opts.ip,
  });
}

/** Revoke a single refresh token (logout). */
export async function revokeSession(refreshToken: string): Promise<void> {
  await database
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.tokenHash, sha256(refreshToken)));
}

/** Revoke every active session for a user (force logout everywhere / password reset). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await database
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
