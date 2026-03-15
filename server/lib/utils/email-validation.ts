/**
 * Email address validation utilities
 *
 * Provides RFC 5322-aligned email validation, domain-level checks, and
 * disposable-address detection helpers for CAN-SPAM compliance.
 */

/** Result returned by email validation functions. */
export interface EmailValidationResult {
  valid: boolean;
  /** Normalized (trimmed, lowercased) email address when valid. */
  normalized?: string;
  /** Human-readable reason for failure. */
  error?: string;
}

/**
 * RFC 5321 / RFC 5322 simplified email regex.
 *
 * Covers the vast majority of real-world email addresses while rejecting
 * obvious invalid forms.  Full RFC 5322 compliance is intentionally not
 * implemented here as it allows constructs that are rejected by virtually
 * every mail server in practice.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/** Maximum total length of an email address per RFC 5321. */
const MAX_EMAIL_LENGTH = 254;

/** Maximum local part length per RFC 5321. */
const MAX_LOCAL_PART_LENGTH = 64;

/**
 * Known disposable / temporary email domains.
 * Extend this list as needed or replace with a proper allow/block-list service.
 */
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "spam4.me",
  "yopmail.com",
  "yopmail.fr",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "trashmail.at",
  "trashmail.io",
  "trashmail.me",
  "trashmail.xyz",
  "discard.email",
  "mailnull.com",
]);

/**
 * Validates and normalizes an email address.
 *
 * @param email - Raw email address string from user input.
 * @returns Validation result with normalized email when valid.
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email address must be a non-empty string." };
  }

  const trimmed = email.trim();

  if (!trimmed) {
    return { valid: false, error: "Email address must not be blank." };
  }

  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return {
      valid: false,
      error: `Email address exceeds maximum length of ${MAX_EMAIL_LENGTH} characters.`,
    };
  }

  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1) {
    return { valid: false, error: 'Email address must contain an "@" symbol.' };
  }

  const localPart = trimmed.slice(0, atIndex);
  if (localPart.length > MAX_LOCAL_PART_LENGTH) {
    return {
      valid: false,
      error: `Email local part exceeds maximum length of ${MAX_LOCAL_PART_LENGTH} characters.`,
    };
  }

  const normalized = trimmed.toLowerCase();

  if (!EMAIL_REGEX.test(normalized)) {
    return {
      valid: false,
      error: `"${trimmed}" is not a valid email address format.`,
    };
  }

  return { valid: true, normalized };
}

/**
 * Returns true when the email's domain is in the known disposable domain list.
 *
 * @param email - Email address to check (raw or normalized).
 */
export function isDisposableEmail(email: string): boolean {
  const domain = extractDomain(email);
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

/**
 * Extracts and returns the domain portion of an email address.
 * Returns undefined if the email is malformed.
 *
 * @param email - Email address string.
 */
export function extractDomain(email: string): string | undefined {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1 || atIndex === email.length - 1) return undefined;
  return email.slice(atIndex + 1).toLowerCase();
}

/**
 * Validates the email and additionally rejects disposable addresses.
 *
 * @param email - Raw email address string.
 * @returns Validation result; invalid when disposable.
 */
export function validateEmailStrict(email: string): EmailValidationResult {
  const result = validateEmail(email);
  if (!result.valid) return result;

  if (isDisposableEmail(email)) {
    return {
      valid: false,
      error: "Disposable or temporary email addresses are not accepted.",
    };
  }

  return result;
}
