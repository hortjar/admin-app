import { createHash, randomBytes } from "node:crypto";

/** Cryptographically-random, URL-safe opaque token (hex). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** SHA-256 hex digest — stores refresh tokens / api keys without the raw value. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Generate an app API key. Returned raw once; only the hash + prefix persist.
 * Format: `uak_<prefix>.<secret>` so we can look up by prefix quickly.
 */
export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const prefix = randomBytes(4).toString("hex");
  const secret = randomBytes(24).toString("hex");
  const raw = `uak_${prefix}.${secret}`;
  return { raw, prefix, hash: sha256(raw) };
}
