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
