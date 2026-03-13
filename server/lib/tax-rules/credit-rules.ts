import type { FilingStatus } from "@server/lib/schemas/tax-payload";

// ── EITC ──────────────────────────────────────────────────────────────────────

export interface EITCParams {
  earnedIncome: number;
  agi: number;
  filingStatus: FilingStatus;
  qualifyingChildren: number;
  taxYear: 2024 | 2025;
  investmentIncome?: number;
}

// Max EITC amounts and earned-income tables for 2024
const EITC_TABLE: Record<
  number,
  Record<number, { maxCredit: number; earnedIncomeMax: number; agiSingleLimit: number; agiJointLimit: number }>
> = {
  2024: {
    0: { maxCredit: 632, earnedIncomeMax: 8490, agiSingleLimit: 18591, agiJointLimit: 25511 },
    1: { maxCredit: 4213, earnedIncomeMax: 12800, agiSingleLimit: 49084, agiJointLimit: 56004 },
    2: { maxCredit: 6960, earnedIncomeMax: 18000, agiSingleLimit: 55768, agiJointLimit: 62698 },
    3: { maxCredit: 7830, earnedIncomeMax: 18000, agiSingleLimit: 59899, agiJointLimit: 66819 },
  },
  2025: {
    0: { maxCredit: 649, earnedIncomeMax: 8730, agiSingleLimit: 19104, agiJointLimit: 26214 },
    1: { maxCredit: 4328, earnedIncomeMax: 13150, agiSingleLimit: 50434, agiJointLimit: 57554 },
    2: { maxCredit: 7152, earnedIncomeMax: 18500, agiSingleLimit: 57310, agiJointLimit: 64430 },
    3: { maxCredit: 8046, earnedIncomeMax: 18500, agiSingleLimit: 61555, agiJointLimit: 68675 },
  },
};

/**
 * Calculate the Earned Income Tax Credit.
 */
export function calculateEITC(params: EITCParams): number {
  const { earnedIncome, agi, filingStatus, taxYear, investmentIncome = 0 } = params;
  const numChildren = Math.min(params.qualifyingChildren, 3);
  const table = EITC_TABLE[taxYear][numChildren];

  // Not eligible for MFS
  if (filingStatus === "married_filing_separately") return 0;

  // Investment income limit: $11,600 (2024)
  const investmentLimit = taxYear === 2024 ? 11600 : 11950;
  if (investmentIncome > investmentLimit) return 0;

  const isJoint = filingStatus === "married_filing_jointly";
  const agiLimit = isJoint ? table.agiJointLimit : table.agiSingleLimit;

  const incomeForTest = Math.min(earnedIncome, agi);
  if (incomeForTest > agiLimit) return 0;

  // Credit phases in and phases out
  if (incomeForTest >= table.earnedIncomeMax) {
    // Phase-out
    const excess = incomeForTest - table.earnedIncomeMax;
    const phaseOutRate = table.maxCredit / (agiLimit - table.earnedIncomeMax);
    return Math.max(0, Math.round((table.maxCredit - excess * phaseOutRate) * 100) / 100);
  }

  // Phase-in
  return Math.min(table.maxCredit, Math.round(earnedIncome * 0.34 * 100) / 100);
}

// ── Child Tax Credit ──────────────────────────────────────────────────────────

/**
 * Calculate the Child Tax Credit and Additional CTC.
 * Returns { childTaxCredit, additionalCTC }
 */
export function calculateChildTaxCredit(
  qualifyingChildren: number,
  agi: number,
  filingStatus: FilingStatus,
  taxYear: 2024 | 2025
): { childTaxCredit: number; additionalCTC: number } {
  if (qualifyingChildren === 0) return { childTaxCredit: 0, additionalCTC: 0 };

  const creditPerChild = 2000;
  const threshold =
    filingStatus === "married_filing_jointly" ? 400000 : 200000;

  // Phase-out: $50 per $1,000 over threshold
  const excess = Math.max(0, agi - threshold);
  const steps = Math.ceil(excess / 1000);
  const reduction = steps * 50;

  const ctc = Math.max(0, qualifyingChildren * creditPerChild - reduction);
  const refundableLimit = qualifyingChildren * 1700; // 2024 refundable amount
  const additionalCTC = Math.min(ctc, refundableLimit);

  return { childTaxCredit: ctc, additionalCTC };
}

// ── American Opportunity Tax Credit ──────────────────────────────────────────

export function calculateAOC(
  qualifiedExpenses: number,
  agi: number,
  filingStatus: FilingStatus
): number {
  const isJoint = filingStatus === "married_filing_jointly";
  const phaseoutStart = isJoint ? 160000 : 80000;
  const phaseoutEnd = isJoint ? 180000 : 90000;

  if (agi >= phaseoutEnd) return 0;

  // AOC: 100% of first $2,000 + 25% of next $2,000 = max $2,500
  const baseCredit = Math.min(qualifiedExpenses, 2000) + Math.min(Math.max(0, qualifiedExpenses - 2000), 2000) * 0.25;
  const credit = Math.min(baseCredit, 2500);

  if (agi <= phaseoutStart) return Math.round(credit * 100) / 100;

  const fraction = (agi - phaseoutStart) / (phaseoutEnd - phaseoutStart);
  return Math.max(0, Math.round(credit * (1 - fraction) * 100) / 100);
}

// ── Lifetime Learning Credit ──────────────────────────────────────────────────

export function calculateLLC(
  qualifiedExpenses: number,
  agi: number,
  filingStatus: FilingStatus
): number {
  const isJoint = filingStatus === "married_filing_jointly";
  const phaseoutStart = isJoint ? 160000 : 80000;
  const phaseoutEnd = isJoint ? 180000 : 90000;

  if (agi >= phaseoutEnd) return 0;

  // LLC: 20% of up to $10,000 in qualified expenses = max $2,000
  const baseCredit = Math.min(qualifiedExpenses, 10000) * 0.2;

  if (agi <= phaseoutStart) return Math.round(baseCredit * 100) / 100;

  const fraction = (agi - phaseoutStart) / (phaseoutEnd - phaseoutStart);
  return Math.max(0, Math.round(baseCredit * (1 - fraction) * 100) / 100);
}

// ── Child & Dependent Care Credit ────────────────────────────────────────────

export function calculateChildCareCredit(
  expenses: number,
  numberOfDependents: number,
  earnedIncome: number,
  agi: number
): number {
  if (earnedIncome <= 0) return 0;

  // Qualifying expense limit: $3,000 (1 child) / $6,000 (2+ children)
  const expenseLimit = numberOfDependents >= 2 ? 6000 : 3000;
  const qualifiedExpenses = Math.min(expenses, expenseLimit, earnedIncome);

  // Credit percentage based on AGI (35% down to 20%)
  let rate = 0.20;
  if (agi <= 15000) rate = 0.35;
  else if (agi <= 43000) rate = 0.35 - Math.ceil((agi - 15000) / 2000) * 0.01;

  return Math.round(qualifiedExpenses * rate * 100) / 100;
}

// ── Retirement Saver's Credit ─────────────────────────────────────────────────

export function calculateRetirementSaversCredit(
  contributions: number,
  agi: number,
  filingStatus: FilingStatus,
  taxYear: 2024 | 2025
): number {
  const limits =
    taxYear === 2024
      ? {
          married_filing_jointly: [{ rate: 0.5, max: 46125 }, { rate: 0.2, max: 50000 }, { rate: 0.1, max: 76500 }],
          head_of_household: [{ rate: 0.5, max: 34594 }, { rate: 0.2, max: 37500 }, { rate: 0.1, max: 57375 }],
          other: [{ rate: 0.5, max: 23063 }, { rate: 0.2, max: 25000 }, { rate: 0.1, max: 38250 }],
        }
      : {
          married_filing_jointly: [{ rate: 0.5, max: 47500 }, { rate: 0.2, max: 51500 }, { rate: 0.1, max: 79000 }],
          head_of_household: [{ rate: 0.5, max: 35625 }, { rate: 0.2, max: 38625 }, { rate: 0.1, max: 59250 }],
          other: [{ rate: 0.5, max: 23750 }, { rate: 0.2, max: 25750 }, { rate: 0.1, max: 39500 }],
        };

  const brackets =
    limits[filingStatus as keyof typeof limits] ?? limits.other;

  let rate = 0;
  for (const bracket of brackets) {
    if (agi <= bracket.max) {
      rate = bracket.rate;
      break;
    }
  }

  if (rate === 0) return 0;

  // Max eligible contribution: $2,000 ($4,000 for MFJ)
  const contribLimit = filingStatus === "married_filing_jointly" ? 4000 : 2000;
  return Math.round(Math.min(contributions, contribLimit) * rate * 100) / 100;
}
