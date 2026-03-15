/**
 * Phone number validation utilities
 *
 * Validates phone numbers in E.164 format and NANP (North American Numbering Plan)
 * format.  Used before storing or sending SMS to ensure deliverability and
 * TCPA compliance.
 */

/** Result returned by all validation functions. */
export interface PhoneValidationResult {
  valid: boolean;
  /** Normalized E.164 form (e.g. "+12125551234") when valid; undefined otherwise. */
  normalized?: string;
  /** Human-readable reason for failure. */
  error?: string;
}

/**
 * E.164 regex: optional leading +, 1–15 digits.
 * International format as required by Twilio.
 */
const E164_REGEX = /^\+?[1-9]\d{1,14}$/;

/**
 * NANP regex: matches common US/Canada formats before normalization.
 * Examples: (212) 555-1234, 212-555-1234, 2125551234, 1-212-555-1234
 */
const NANP_LOOSE_REGEX = /^(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})$/;

/** Digits-only version of a phone string. */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Validates and normalizes a phone number to E.164 format.
 *
 * Accepts:
 * - Already-normalized E.164  ("+12125551234")
 * - NANP with or without country code  ("212-555-1234", "1-212-555-1234")
 * - Digits-only 10 or 11-digit strings ("2125551234", "12125551234")
 *
 * @param phone - Raw phone number string from user input.
 * @returns Validation result with normalized E.164 string when valid.
 */
export function validatePhone(phone: string): PhoneValidationResult {
  if (!phone || typeof phone !== "string") {
    return { valid: false, error: "Phone number must be a non-empty string." };
  }

  const trimmed = phone.trim();

  if (!trimmed) {
    return { valid: false, error: "Phone number must not be blank." };
  }

  // Strip formatting and attempt normalization
  const digits = digitsOnly(trimmed);

  if (digits.length === 0) {
    return { valid: false, error: "Phone number contains no digits." };
  }

  // Try NANP normalization first (10-digit or 11-digit with leading 1)
  if (NANP_LOOSE_REGEX.test(trimmed) || digits.length === 10 || digits.length === 11) {
    const nanpResult = normalizeNANP(digits);
    if (nanpResult.valid) return nanpResult;
  }

  // Try raw E.164 validation
  if (E164_REGEX.test(trimmed)) {
    const e164 = trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
    return { valid: true, normalized: e164 };
  }

  return {
    valid: false,
    error: `"${trimmed}" is not a recognized phone number format. Use E.164 (e.g. +12125551234) or NANP (e.g. 212-555-1234).`,
  };
}

/**
 * Normalizes a NANP (North American Numbering Plan) phone number to E.164.
 *
 * Handles 10-digit (area code + 7-digit) or 11-digit (country code 1 +
 * area code + 7-digit) inputs.
 *
 * @param digits - Digits-only phone string (10 or 11 characters).
 * @returns Validation result with "+1XXXXXXXXXX" form when valid.
 */
export function normalizeNANP(digits: string): PhoneValidationResult {
  let core = digits;

  if (digits.length === 11) {
    if (digits[0] !== "1") {
      return {
        valid: false,
        error: `11-digit NANP numbers must start with country code 1, got "${digits[0]}".`,
      };
    }
    core = digits.slice(1);
  }

  if (core.length !== 10) {
    return {
      valid: false,
      error: `NANP phone number must be 10 digits (got ${core.length}).`,
    };
  }

  const areaCode = core.slice(0, 3);
  const exchange = core.slice(3, 6);

  // NANP area codes cannot start with 0 or 1
  if (areaCode[0] === "0" || areaCode[0] === "1") {
    return {
      valid: false,
      error: `Invalid NANP area code "${areaCode}": area codes cannot start with 0 or 1.`,
    };
  }

  // Exchange codes cannot start with 0 or 1
  if (exchange[0] === "0" || exchange[0] === "1") {
    return {
      valid: false,
      error: `Invalid NANP exchange code "${exchange}": exchange codes cannot start with 0 or 1.`,
    };
  }

  return { valid: true, normalized: `+1${core}` };
}

/**
 * Strict E.164 validation (no normalization attempted).
 *
 * @param phone - Phone number string, must already be in E.164 format.
 * @returns True when the string is a valid E.164 number.
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * Returns true when the phone number is a valid US/Canada NANP number
 * (after normalization).
 *
 * @param phone - Raw phone number in any supported format.
 */
export function isNANP(phone: string): boolean {
  const result = validatePhone(phone);
  return result.valid && (result.normalized?.startsWith("+1") ?? false);
}
