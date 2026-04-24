/**
 * AES-256-GCM encryption/decryption utilities for PII
 *
 * Exports two API styles:
 *  - encrypt / decrypt  (new style, colon-delimited hex ciphertext)
 *  - encryptSSN / decryptSSN (legacy base64 style, kept for compatibility)
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash, createHmac, type CipherGCM, type DecipherGCM } from "node:crypto";

// ── Constants ─────────────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FIELD_SEP = ":";

// ── Key helpers ───────────────────────────────────────────────────────────────

/** Returns a 32-byte key derived from ENCRYPTION_KEY (hex-encoded). */
function getHexKey(): Buffer {
  const hexKey = process.env["ENCRYPTION_KEY"];
  if (!hexKey) throw new Error("ENCRYPTION_KEY environment variable is not set.");
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes (${KEY_BYTES * 2} hex chars). Got ${key.length} bytes.`
    );
  }
  return key;
}

/** Returns a 32-byte key derived from ENCRYPTION_KEY via SHA-256 (legacy style). */
function getSha256Key(): Buffer {
  const keySource = process.env["ENCRYPTION_KEY"];
  if (!keySource) throw new Error("ENCRYPTION_KEY environment variable is not set.");
  return createHash("sha256").update(keySource).digest();
}

// ── New-style API: hex colon-delimited format ─────────────────────────────────

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns `<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 */
export function encrypt(plaintext: string): string {
  const key = getHexKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from("rtps-pii-v1"));
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(FIELD_SEP);
}

/** Decrypts a ciphertext produced by {@link encrypt}. */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(FIELD_SEP);
  if (parts.length !== 3) {
    throw new Error(`Invalid ciphertext format. Expected "iv:authTag:data", got ${parts.length} parts.`);
  }
  const [ivHex, authTagHex, dataHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const key = getHexKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from("rtps-pii-v1"));
  decipher.setAuthTag(authTag);
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Decryption failed: authentication tag mismatch. Data may have been tampered with.");
  }
}

/** Decrypts a nullable ciphertext field from the database. */
export function decryptNullable(ciphertext: string | null | undefined): string | null {
  if (ciphertext == null) return null;
  return decrypt(ciphertext);
}

/** Encrypts a nullable plaintext value. */
export function encryptNullable(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  return encrypt(plaintext);
}

/** Structural check for RTPS ciphertext format (does not attempt decryption). */
export function isCiphertextFormat(value: string): boolean {
  const parts = value.split(FIELD_SEP);
  if (parts.length !== 3) return false;
  const [iv, tag, data] = parts as [string, string, string];
  return /^[0-9a-f]+$/i.test(iv) && /^[0-9a-f]+$/i.test(tag) && /^[0-9a-f]+$/i.test(data);
}

// ── Legacy API: base64 format ─────────────────────────────────────────────────

/** Encrypts a sensitive string (SSN, EIN, bank account) — base64 format. */
export function encryptSSN(value: string): string {
  const key = getSha256Key();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv) as CipherGCM;
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/** Decrypts a value encrypted by {@link encryptSSN}. */
export function decryptSSN(encryptedBase64: string): string {
  const key = getSha256Key();
  const data = Buffer.from(encryptedBase64, "base64");
  const iv = data.subarray(0, IV_BYTES);
  const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = data.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv) as DecipherGCM;
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}

/** HMAC-SHA256 hash for indexed lookups (deterministic, not reversible). */
export function hashForLookup(value: string): string {
  const key = getSha256Key();
  return createHmac("sha256", key).update(value).digest("hex");
}

/** Alias for {@link encryptSSN}. */
export const encryptSensitive = encryptSSN;

/** Alias for {@link decryptSSN}. */
export const decryptSensitive = decryptSSN;

