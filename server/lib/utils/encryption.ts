import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Derive a 32-byte key from the environment variable.
 * Uses SHA-256 so any length string works as a key source.
 */
function getEncryptionKey(): Buffer {
  const keySource = process.env.ENCRYPTION_KEY;
  if (!keySource) {
    throw new Error("ENCRYPTION_KEY environment variable is not set.");
  }
  return crypto.createHash("sha256").update(keySource).digest();
}

/**
 * Encrypt a sensitive value (SSN, EIN, bank account) using AES-256-GCM.
 * Returns a Base64-encoded string: IV + ciphertext + auth tag.
 */
export function encryptSSN(ssn: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(ssn, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Layout: [iv (12)] [tag (16)] [ciphertext]
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a value encrypted by encryptSSN.
 */
export function decryptSSN(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedBase64, "base64");

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}

/**
 * Create an HMAC-SHA256 hash of a value for use in indexed lookups.
 * The hash is deterministic but cannot be reversed to the original value.
 */
export function hashForLookup(value: string): string {
  const key = getEncryptionKey();
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

/**
 * Encrypt any sensitive string (alias for encryptSSN, works for EIN, bank accounts, etc.)
 */
export const encryptSensitive = encryptSSN;

/**
 * Decrypt any sensitive string.
 */
export const decryptSensitive = decryptSSN;
/**
 * AES-256-GCM encryption/decryption utilities for PII
 *
 * Used to encrypt phone numbers and email addresses before storing them in
 * the database.  The encryption key is sourced from the ENCRYPTION_KEY
 * environment variable (64-char hex = 32 bytes).
 *
 * Ciphertext format (colon-delimited, all hex-encoded):
 *   <iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * This format is self-contained – the IV and auth tag travel with the
 * ciphertext so each encryption call produces a unique, independently
 * decryptable value.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM IV length in bytes (96-bit / 12-byte is the NIST recommendation). */
const IV_LENGTH = 12;

/** AES-256-GCM authentication tag length in bytes. */
const AUTH_TAG_LENGTH = 16;

/** Expected key length in bytes for AES-256. */
const KEY_LENGTH = 32;

/** Separator used in the serialized ciphertext format. */
const FIELD_SEP = ":";

/**
 * Retrieves and validates the encryption key from the environment.
 * Throws if the key is missing or not 32 bytes.
 *
 * @throws {Error} When ENCRYPTION_KEY is missing or has an incorrect length.
 */
function getEncryptionKey(): Buffer {
  const hexKey = process.env["ENCRYPTION_KEY"];
  if (!hexKey) {
    throw new Error("ENCRYPTION_KEY environment variable is not set.");
  }
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars). Got ${key.length} bytes.`,
    );
  }
  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * A fresh random 12-byte IV is generated for every call, ensuring that
 * encrypting the same value twice produces different ciphertexts (semantic
 * security).
 *
 * @param plaintext - The string to encrypt (e.g. phone number or email).
 * @returns Serialized ciphertext: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 * @throws {Error} When the encryption key is invalid.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("rtps-pii-v1")); // additional authenticated data

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(
    FIELD_SEP,
  );
}

/**
 * Decrypts a ciphertext produced by {@link encrypt}.
 *
 * @param ciphertext - Serialized ciphertext in `<iv_hex>:<authTag_hex>:<data_hex>` format.
 * @returns The original plaintext string.
 * @throws {Error} When the ciphertext format is invalid, the key is wrong, or
 *   authentication fails (tampered data).
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(FIELD_SEP);
  if (parts.length !== 3) {
    throw new Error(
      `Invalid ciphertext format. Expected "iv:authTag:data", got ${parts.length} parts.`,
    );
  }

  const [ivHex, authTagHex, dataHex] = parts as [string, string, string];

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}.`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}.`,
    );
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from("rtps-pii-v1"));
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error(
      "Decryption failed: authentication tag mismatch. Data may have been tampered with.",
    );
  }
}

/**
 * Safely decrypts a nullable ciphertext field from the database.
 *
 * @param ciphertext - Encrypted string or null/undefined.
 * @returns Decrypted plaintext, or null when the input is nullish.
 */
export function decryptNullable(ciphertext: string | null | undefined): string | null {
  if (ciphertext == null) return null;
  return decrypt(ciphertext);
}

/**
 * Safely encrypts a nullable plaintext value.
 *
 * @param plaintext - String to encrypt or null/undefined.
 * @returns Encrypted ciphertext, or null when the input is nullish.
 */
export function encryptNullable(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  return encrypt(plaintext);
}

/**
 * Checks whether a string looks like a valid RTPS ciphertext (structural check only,
 * does not attempt decryption).
 *
 * @param value - String to inspect.
 */
export function isCiphertextFormat(value: string): boolean {
  const parts = value.split(FIELD_SEP);
  if (parts.length !== 3) return false;
  const [iv, tag, data] = parts as [string, string, string];
  return (
    /^[0-9a-f]+$/i.test(iv) &&
    /^[0-9a-f]+$/i.test(tag) &&
    /^[0-9a-f]+$/i.test(data)
  );
}
