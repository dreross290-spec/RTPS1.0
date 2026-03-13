import { STANDARD_DEDUCTIONS } from "@server/lib/constants/tax-brackets";
import type { FilingStatus } from "./tax-calculator";

// ── AGI Calculation ───────────────────────────────────────────────────────────

export interface IncomeData {
  wages: number;
  interest: number;
  dividends: number;
  qualifiedDividends?: number;
  businessIncome: number;
  capitalGains?: number;
  rentalIncome?: number;
  socialSecurity?: number;
  pensionIncome?: number;
  otherIncome?: number;
  // Above-the-line deductions
  studentLoanInterest?: number;
  seTaxDeduction?: number;
  seHealthInsurance?: number;
  iraDeduction?: number;
  educatorExpenses?: number;
  hsaDeduction?: number;
  alimonyPaid?: number;
}

export interface DeductionData {
  deductionType: "standard" | "itemized";
  mortgageInterest?: number;
  charitableContributions?: number;
  stateTaxesPaid?: number;
  localTaxesPaid?: number;
  medicalExpenses?: number;
  casualtyLosses?: number;
  otherItemized?: number;
}

/**
 * Calculate Adjusted Gross Income (AGI).
 */
export function calculateAGI(incomeData: IncomeData): number {
  const grossIncome =
    (incomeData.wages ?? 0) +
    (incomeData.interest ?? 0) +
    (incomeData.dividends ?? 0) +
    (incomeData.businessIncome ?? 0) +
    (incomeData.capitalGains ?? 0) +
    (incomeData.rentalIncome ?? 0) +
    (incomeData.pensionIncome ?? 0) +
    (incomeData.otherIncome ?? 0) +
    calculateSocialSecurityInclusion(
      incomeData.socialSecurity ?? 0,
      grossIncomeBeforeSS(incomeData)
    );

  const aboveTheLineDeductions =
    (incomeData.studentLoanInterest ?? 0) +
    (incomeData.seTaxDeduction ?? 0) +
    (incomeData.seHealthInsurance ?? 0) +
    (incomeData.iraDeduction ?? 0) +
    (incomeData.educatorExpenses ?? 0) +
    (incomeData.hsaDeduction ?? 0) +
    (incomeData.alimonyPaid ?? 0);

  return Math.max(0, grossIncome - aboveTheLineDeductions);
}

function grossIncomeBeforeSS(incomeData: IncomeData): number {
  return (
    (incomeData.wages ?? 0) +
    (incomeData.interest ?? 0) +
    (incomeData.dividends ?? 0) +
    (incomeData.businessIncome ?? 0) +
    (incomeData.capitalGains ?? 0) +
    (incomeData.rentalIncome ?? 0) +
    (incomeData.pensionIncome ?? 0) +
    (incomeData.otherIncome ?? 0)
  );
}

/**
 * Calculate how much Social Security income is taxable.
 */
function calculateSocialSecurityInclusion(ss: number, otherIncome: number): number {
  if (ss === 0) return 0;
  const provisionalIncome = otherIncome + ss * 0.5;
  if (provisionalIncome <= 25000) return 0;
  if (provisionalIncome <= 34000) {
    return Math.min(ss * 0.5, (provisionalIncome - 25000) * 0.5);
  }
  const tier1 = Math.min(ss * 0.5, 4500);
  const tier2 = Math.min(ss * 0.85 - tier1, (provisionalIncome - 34000) * 0.85);
  return Math.min(ss * 0.85, tier1 + tier2);
}

/**
 * Calculate federal taxable income from AGI, deductions, and exemptions.
 */
export function calculateFederalTaxableIncome(
  agi: number,
  deductions: DeductionData,
  taxYear: 2024 | 2025,
  filingStatus: FilingStatus
): number {
  const deductionAmount =
    deductions.deductionType === "itemized"
      ? calculateItemizedDeductions(deductions, agi)
      : (STANDARD_DEDUCTIONS[taxYear][filingStatus] ?? 0);

  return Math.max(0, agi - deductionAmount);
}

/**
 * Calculate total itemized deductions (subject to limits).
 */
export function calculateItemizedDeductions(
  deductions: DeductionData,
  agi: number
): number {
  // SALT cap: $10,000 for MFJ/Single, $5,000 for MFS
  const saltCap = 10000;
  const saltPaid = Math.min(
    (deductions.stateTaxesPaid ?? 0) + (deductions.localTaxesPaid ?? 0),
    saltCap
  );

  // Medical expenses: only amount above 7.5% of AGI
  const medicalThreshold = agi * 0.075;
  const medicalDeductible = Math.max(
    0,
    (deductions.medicalExpenses ?? 0) - medicalThreshold
  );

  return (
    (deductions.mortgageInterest ?? 0) +
    (deductions.charitableContributions ?? 0) +
    saltPaid +
    medicalDeductible +
    (deductions.casualtyLosses ?? 0) +
    (deductions.otherItemized ?? 0)
  );
}

// ── Phase-Outs ────────────────────────────────────────────────────────────────

export interface PhaseOutInput {
  amount: number;
  agi: number;
  threshold: number;
  range: number;
  reductionRate?: number; // defaults to 0.05 (5% per $2,500 increment)
}

/**
 * Apply phase-out reduction to a credit or deduction.
 */
export function applyPhaseOuts(agi: number, credits: Record<string, PhaseOutInput>): Record<string, number> {
  const result: Record<string, number> = {};

  Object.entries(credits).forEach(([key, params]) => {
    if (agi <= params.threshold) {
      result[key] = params.amount;
      return;
    }

    const excess = agi - params.threshold;
    const reductionRate = params.reductionRate ?? 0.05;
    // Reduction in $2,500 increments (round up)
    const increments = Math.ceil(excess / 2500);
    const reduction = increments * 2500 * reductionRate;
    result[key] = Math.max(0, params.amount - reduction);
  });

  return result;
}
