/**
 * PII masking utilities
 *
 * Provides functions to mask phone numbers and email addresses before writing
 * them to logs, audit tables, or any surface where raw PII must not appear.
 * Masking is one-way and lossy – it cannot be reversed.
 */

/**
 * Masks a phone number for safe logging, retaining the country code and
 * last 4 digits.
 *
 * Examples:
 *   "+12125551234"  →  "+1******1234"
 *   "+442012345678" →  "+44*****5678"
 *   "2125551234"    →  "******1234"
 *
 * @param phone - Phone number string in any format.
 * @returns Masked phone string.  Returns "[invalid]" when input is empty.
 */
export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== "string") return "[invalid]";

  const trimmed = phone.trim();
  if (!trimmed) return "[invalid]";

  // Handle E.164 with explicit + prefix
  if (trimmed.startsWith("+")) {
    // Preserve country code (digits until we've consumed a sane prefix length)
    // Heuristic: +1 (NANP) = 2 chars prefix, others 2–4.
    const digits = trimmed.slice(1); // strip leading +
    const ccLength = digits.startsWith("1") ? 1 : digits.startsWith("44") ? 2 : 1;
    const cc = `+${digits.slice(0, ccLength)}`;
    const rest = digits.slice(ccLength);
    const last4 = rest.slice(-4);
    const masked = "*".repeat(Math.max(0, rest.length - 4));
    return `${cc}${masked}${last4}`;
  }

  // Plain digits or other formats – keep last 4
  const last4 = trimmed.slice(-4);
  const masked = "*".repeat(Math.max(0, trimmed.length - 4));
  return `${masked}${last4}`;
}

/**
 * Masks an email address, showing only the first character of the local part
 * and the full domain.
 *
 * Examples:
 *   "john.doe@example.com" →  "j***@example.com"
 *   "a@b.com"              →  "a***@b.com"
 *
 * @param email - Email address string.
 * @returns Masked email string.  Returns "[invalid]" when input is empty or
 *   lacks an "@" symbol.
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "[invalid]";

  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf("@");

  if (atIndex === -1) return "[invalid]";

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (!localPart) return `***@${domain}`;

  const firstChar = localPart[0] ?? "*";
  return `${firstChar}***@${domain}`;
}

/**
 * Masks a tax identification number (SSN / EIN / ITIN) by showing only the
 * last 4 digits.
 *
 * Examples:
 *   "123-45-6789" →  "***-**-6789"
 *   "123456789"   →  "*****6789"
 *
 * @param taxId - Tax identifier string (with or without dashes).
 * @returns Masked tax ID.  Returns "[invalid]" when input is empty.
 */
export function maskTaxId(taxId: string): string {
  if (!taxId || typeof taxId !== "string") return "[invalid]";

  const trimmed = taxId.trim();
  if (!trimmed) return "[invalid]";

  // Preserve dashes at known SSN positions
  if (/^\d{3}-\d{2}-\d{4}$/.test(trimmed)) {
    return `***-**-${trimmed.slice(-4)}`;
  }

  // EIN format XX-XXXXXXX
  if (/^\d{2}-\d{7}$/.test(trimmed)) {
    return `**-***${trimmed.slice(-4)}`;
  }

  // Plain digits or other formats – keep last 4, but if too short always mask fully
  if (trimmed.length <= 4) {
    return "*".repeat(trimmed.length);
  }
  const last4 = trimmed.slice(-4);
  const masked = "*".repeat(Math.max(0, trimmed.length - 4));
  return `${masked}${last4}`;
}

/**
 * Sanitizes an object for logging by masking known PII field names in-place.
 *
 * Field names inspected (case-insensitive):
 *   phone, phoneNumber, email, emailAddress, ssn, taxId, tin
 *
 * @param obj - Arbitrary object potentially containing PII fields.
 * @returns A new shallow-cloned object with PII fields masked.
 */
export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const PHONE_FIELDS = new Set(["phone", "phonenumber", "smsphonenumber"]);
  const EMAIL_FIELDS = new Set(["email", "emailaddress"]);
  const TAXID_FIELDS = new Set(["ssn", "taxid", "tin", "ein", "itin"]);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (PHONE_FIELDS.has(lowerKey) && typeof value === "string") {
      result[key] = maskPhone(value);
    } else if (EMAIL_FIELDS.has(lowerKey) && typeof value === "string") {
      result[key] = maskEmail(value);
    } else if (TAXID_FIELDS.has(lowerKey) && typeof value === "string") {
      result[key] = maskTaxId(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
