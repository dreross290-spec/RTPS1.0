/**
 * Validate that a string is a properly formatted and plausible SSN.
 * Checks format (XXX-XX-XXXX or 9 digits) and rejects known invalid patterns.
 */
export function validateSSN(ssn: string): { valid: boolean; error?: string } {
  // Strip dashes and spaces
  const digits = ssn.replace(/[-\s]/g, "");

  if (!/^\d{9}$/.test(digits)) {
    return { valid: false, error: "SSN must be exactly 9 digits." };
  }

  const area = digits.substring(0, 3);
  const group = digits.substring(3, 5);
  const serial = digits.substring(5, 9);

  // Area 000 is invalid
  if (area === "000") {
    return { valid: false, error: "SSN area number cannot be 000." };
  }

  // Area 666 is reserved and invalid
  if (area === "666") {
    return { valid: false, error: "SSN area number 666 is not valid." };
  }

  // Areas 900-999 are reserved (ITINs use 900-999)
  if (parseInt(area, 10) >= 900) {
    return { valid: false, error: "SSN area 900-999 is reserved for ITINs." };
  }

  // Group 00 is invalid
  if (group === "00") {
    return { valid: false, error: "SSN group number cannot be 00." };
  }

  // Serial 0000 is invalid
  if (serial === "0000") {
    return { valid: false, error: "SSN serial number cannot be 0000." };
  }

  // Advertising/test SSNs
  const INVALID_SSNS = new Set([
    "078051120", // Famous test SSN used in wallets
    "219099999",
    "111111111",
    "222222222",
    "333333333",
    "444444444",
    "555555555",
    "666666666",
    "777777777",
    "888888888",
    "123456789",
    "987654321",
  ]);

  if (INVALID_SSNS.has(digits)) {
    return { valid: false, error: "SSN matches a known invalid number." };
  }

  return { valid: true };
}

/**
 * Format a raw 9-digit SSN string as XXX-XX-XXXX.
 */
export function formatSSN(ssn: string): string {
  const digits = ssn.replace(/[-\s]/g, "");
  if (digits.length !== 9) return ssn;
  return `${digits.substring(0, 3)}-${digits.substring(3, 5)}-${digits.substring(5, 9)}`;
}

/**
 * Mask an SSN, showing only the last 4 digits: XXX-XX-1234.
 */
export function maskSSN(ssn: string): string {
  const digits = ssn.replace(/[-\s]/g, "");
  if (digits.length !== 9) return "XXX-XX-XXXX";
  return `XXX-XX-${digits.substring(5, 9)}`;
}

/**
 * Validate an ITIN (Individual Taxpayer Identification Number).
 * ITINs have area number 900-999 and group number 70-88, 90-92, 94-99.
 */
export function validateITIN(itin: string): { valid: boolean; error?: string } {
  const digits = itin.replace(/[-\s]/g, "");

  if (!/^\d{9}$/.test(digits)) {
    return { valid: false, error: "ITIN must be exactly 9 digits." };
  }

  const area = parseInt(digits.substring(0, 3), 10);
  const group = parseInt(digits.substring(3, 5), 10);

  if (area < 900 || area > 999) {
    return { valid: false, error: "ITIN area must be between 900 and 999." };
  }

  // Valid ITIN group numbers: 70-88, 90-92, 94-99
  const validGroups =
    (group >= 70 && group <= 88) ||
    (group >= 90 && group <= 92) ||
    (group >= 94 && group <= 99);

  if (!validGroups) {
    return {
      valid: false,
      error: "ITIN group number is not valid. Valid groups: 70-88, 90-92, 94-99.",
    };
  }

  return { valid: true };
}
