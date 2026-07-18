import { eq } from "drizzle-orm";
import {
  createLocalJWKSet,
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  importPKCS8,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from "jose";

import { database, signingKeys, type SigningKeyRow } from "../db";
import { env } from "../env";

export interface ActiveKey {
  kid: string;
  privateKey: CryptoKey;
  publicJwk: Record<string, unknown>;
}

let cache: { active: ActiveKey; all: SigningKeyRow[] } | null = null;
let localJwkSet: JWTVerifyGetKey | null = null;

const ALG = "RS256";

async function rowToActiveKey(row: SigningKeyRow): Promise<ActiveKey> {
  const privateKey = await importPKCS8(row.privatePem, ALG);
  return { kid: row.kid, privateKey, publicJwk: row.publicJwk };
}

async function createSigningKey(): Promise<SigningKeyRow> {
  let privatePem: string;

  if (env.signingKeyPemBase64) {
    privatePem = Buffer.from(env.signingKeyPemBase64, "base64").toString("utf8");
  } else {
    const { privateKey } = await generateKeyPair(ALG, { extractable: true });
    privatePem = await exportPKCS8(privateKey);
  }

  const privateKey = await importPKCS8(privatePem, ALG, { extractable: true });
  const jwk = await exportJWK(privateKey);
  const kid = crypto.randomUUID();
  const publicJwk = {
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
    alg: ALG,
    use: "sig",
    kid,
  } as Record<string, unknown>;

  const [row] = await database
    .insert(signingKeys)
    .values({ kid, privatePem, publicJwk })
    .returning();
  if (!row) throw new Error("Failed to persist signing key");
  return row;
}

/** Loads (or lazily creates) the active signing key + the full set for JWKS. */
export async function getKeys(): Promise<{ active: ActiveKey; all: SigningKeyRow[] }> {
  if (cache) return cache;

  let all = await database.select().from(signingKeys);
  let activeRow = all.find((k) => k.active);

  if (!activeRow) {
    activeRow = await createSigningKey();
    all = [...all, activeRow];
  }

  cache = { active: await rowToActiveKey(activeRow), all };
  return cache;
}

export const SIGNING_ALG = ALG;

/** Build the public JWKS document from all non-retired keys. */
export async function getJwks(): Promise<{ keys: Record<string, unknown>[] }> {
  const { all } = await getKeys();
  return { keys: all.filter((k) => !k.retiredAt).map((k) => k.publicJwk) };
}

/**
 * Local key resolver for verifying our own tokens with the PUBLIC keys,
 * matching on `kid` so tokens signed before a rotation still verify.
 */
export async function getLocalJwkSet(): Promise<JWTVerifyGetKey> {
  if (localJwkSet) return localJwkSet;
  const jwks = (await getJwks()) as unknown as JSONWebKeySet;
  localJwkSet = createLocalJWKSet(jwks);
  return localJwkSet;
}

/** Rotate: mark current active key inactive (kept for verification), mint a new one. */
export async function rotateSigningKey(): Promise<void> {
  const { active } = await getKeys();
  await database.update(signingKeys).set({ active: false }).where(eq(signingKeys.kid, active.kid));
  cache = null;
  localJwkSet = null;
  await createSigningKey();
  cache = null;
  localJwkSet = null;
}
