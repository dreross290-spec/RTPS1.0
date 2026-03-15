import { STANDARD_DEDUCTIONS, AMT_EXEMPTIONS } from "@server/lib/constants/tax-brackets";
import type { FilingStatus } from "@server/lib/schemas/tax-payload";

// ── Standard Deduction ────────────────────────────────────────────────────────

/**
 * Get the standard deduction for a filing status and tax year.
 * Adds additional deductions for age 65+ or blind taxpayers.
 */
export function getStandardDeduction(
  filingStatus: FilingStatus,
  taxYear: 2024 | 2025,
  options: {
    taxpayerAge65: boolean;
    taxpayerBlind: boolean;
    spouseAge65?: boolean;
    spouseBlind?: boolean;
  } = { taxpayerAge65: false, taxpayerBlind: false }
): number {
  const base = STANDARD_DEDUCTIONS[taxYear][filingStatus] ?? 0;
  const isJoint = filingStatus === "married_filing_jointly";
  const addl = isJoint
    ? STANDARD_DEDUCTIONS[taxYear].additional_65_or_blind_joint
    : STANDARD_DEDUCTIONS[taxYear].additional_65_or_blind_single;

  let additions = 0;
  if (options.taxpayerAge65) additions += addl;
  if (options.taxpayerBlind) additions += addl;
  if (isJoint) {
    if (options.spouseAge65) additions += addl;
    if (options.spouseBlind) additions += addl;
  }

  return base + additions;
}

// ── Personal Exemptions ───────────────────────────────────────────────────────

// Post-TCJA (2018+), personal exemptions are $0 at the federal level
export function getPersonalExemption(_taxYear: number): number {
  return 0;
}

// ── AMT Exemptions ────────────────────────────────────────────────────────────

export function getAMTExemption(
  filingStatus: FilingStatus,
  taxYear: 2024 | 2025,
  agi: number
): number {
  const key =
    filingStatus === "married_filing_jointly" ? "marriedFilingJointly" : "single";
  const { exemption, phaseout } = AMT_EXEMPTIONS[taxYear][key];

  // Phase-out: 25 cents per dollar over threshold
  const excess = Math.max(0, agi - phaseout);
  return Math.max(0, exemption - excess * 0.25);
}

// ── SALT Deduction Limit ──────────────────────────────────────────────────────

/**
 * Post-TCJA SALT cap: $10,000 for all filers except MFS ($5,000).
 */
export function getSALTLimit(filingStatus: FilingStatus): number {
  return filingStatus === "married_filing_separately" ? 5000 : 10000;
}

// ── Phase-Out Thresholds ──────────────────────────────────────────────────────

export const PHASE_OUT_THRESHOLDS: Record<
  number,
  {
    childTaxCredit: Record<string, number>;
    eitc: Record<string, { limit: number }>;
    itemizedDeductions: Record<string, number>;
    studentLoanInterest: Record<string, { start: number; end: number }>;
  }
> = {
  2024: {
    childTaxCredit: {
      single: 200000,
      married_filing_jointly: 400000,
      married_filing_separately: 200000,
      head_of_household: 200000,
    },
    eitc: {
      // EITC has complex earned-income lookups; simplified thresholds below
      "0_children_single": { limit: 18591 },
      "0_children_joint": { limit: 25511 },
      "1_child_single": { limit: 49084 },
      "1_child_joint": { limit: 56004 },
      "2_children_single": { limit: 55768 },
      "2_children_joint": { limit: 62698 },
      "3_children_single": { limit: 59899 },
      "3_children_joint": { limit: 66819 },
    },
    itemizedDeductions: {}, // No Pease limitation post-TCJA
    studentLoanInterest: {
      single: { start: 80000, end: 95000 },
      married_filing_jointly: { start: 165000, end: 195000 },
    },
  },
  2025: {
    childTaxCredit: {
      single: 200000,
      married_filing_jointly: 400000,
      married_filing_separately: 200000,
      head_of_household: 200000,
    },
    eitc: {
      "0_children_single": { limit: 19104 },
      "0_children_joint": { limit: 26214 },
      "1_child_single": { limit: 50434 },
      "1_child_joint": { limit: 57554 },
      "2_children_single": { limit: 57310 },
      "2_children_joint": { limit: 64430 },
      "3_children_single": { limit: 61555 },
      "3_children_joint": { limit: 68675 },
    },
    itemizedDeductions: {},
    studentLoanInterest: {
      single: { start: 85000, end: 100000 },
      married_filing_jointly: { start: 175000, end: 205000 },
    },
  },
};
