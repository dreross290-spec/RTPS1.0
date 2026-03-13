import { TAX_BRACKETS, STANDARD_DEDUCTIONS, AMT_EXEMPTIONS } from "@server/lib/constants/tax-brackets";

export type FilingStatus =
  | "single"
  | "married_filing_jointly"
  | "married_filing_separately"
  | "head_of_household"
  | "qualifying_widow";

// ── Federal Tax ───────────────────────────────────────────────────────────────

/**
 * Calculate federal income tax using current-year brackets.
 */
export function calculateFederalTax(
  taxableIncome: number,
  filingStatus: FilingStatus,
  taxYear: 2024 | 2025 = 2024
): number {
  const brackets = TAX_BRACKETS[taxYear][filingStatus];
  return applyBracketsInternal(Math.max(0, taxableIncome), brackets);
}

function applyBracketsInternal(
  income: number,
  brackets: Array<{ rate: number; min: number; max: number }>
): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.min) break;
    const taxable = Math.min(income, bracket.max) - bracket.min;
    tax += taxable * bracket.rate;
  }
  return roundToDollar(tax);
}

// ── AMT ───────────────────────────────────────────────────────────────────────

export interface AMTParams {
  amtIncome: number; // AMTI before exemption
  filingStatus: FilingStatus;
  taxYear: 2024 | 2025;
}

/**
 * Calculate Alternative Minimum Tax.
 */
export function calculateAMT(params: AMTParams): number {
  const { amtIncome, filingStatus, taxYear } = params;
  const exemptions = AMT_EXEMPTIONS[taxYear];
  const exemptionKey =
    filingStatus === "married_filing_jointly" ? "marriedFilingJointly" : "single";

  const exemptionAmount = exemptions[exemptionKey]?.exemption ?? 0;
  const phaseoutThreshold = exemptions[exemptionKey]?.phaseout ?? Infinity;

  // Phase-out exemption at 25 cents per dollar over threshold
  const phaseoutReduction = Math.max(0, (amtIncome - phaseoutThreshold) * 0.25);
  const effectiveExemption = Math.max(0, exemptionAmount - phaseoutReduction);
  const amtBase = Math.max(0, amtIncome - effectiveExemption);

  // Two-tier AMT rates: 26% up to $220,700 (2024), 28% above
  const breakPoint = taxYear === 2024 ? 220700 : 232600;
  let amt = 0;
  if (amtBase <= breakPoint) {
    amt = amtBase * 0.26;
  } else {
    amt = breakPoint * 0.26 + (amtBase - breakPoint) * 0.28;
  }

  return roundToDollar(amt);
}

// ── Self-Employment Tax ───────────────────────────────────────────────────────

/**
 * Calculate self-employment tax (SECA).
 * Returns { seTax, deductiblePortion }
 */
export function calculateSETax(netSEIncome: number): {
  seTax: number;
  deductiblePortion: number;
} {
  if (netSEIncome <= 0) return { seTax: 0, deductiblePortion: 0 };

  const SEWages = netSEIncome * 0.9235; // 92.35% of SE income
  const SS_WAGE_BASE = 168600; // 2024

  const ssTax = Math.min(SEWages, SS_WAGE_BASE) * 0.124;
  const medicareTax = SEWages * 0.029;
  const seTax = roundToDollar(ssTax + medicareTax);

  return {
    seTax,
    deductiblePortion: roundToDollar(seTax / 2),
  };
}

// ── State Tax ─────────────────────────────────────────────────────────────────

const STATE_TAX_RATES: Record<
  string,
  Array<{ rate: number; min: number; max: number }>
> = {
  CA: [
    { rate: 0.01, min: 0, max: 10099 },
    { rate: 0.02, min: 10099, max: 23942 },
    { rate: 0.04, min: 23942, max: 37788 },
    { rate: 0.06, min: 37788, max: 52455 },
    { rate: 0.08, min: 52455, max: 66295 },
    { rate: 0.093, min: 66295, max: 338639 },
    { rate: 0.103, min: 338639, max: 406364 },
    { rate: 0.113, min: 406364, max: 677275 },
    { rate: 0.123, min: 677275, max: Infinity },
  ],
  NY: [
    { rate: 0.04, min: 0, max: 8500 },
    { rate: 0.045, min: 8500, max: 11700 },
    { rate: 0.0525, min: 11700, max: 13900 },
    { rate: 0.0585, min: 13900, max: 80650 },
    { rate: 0.0625, min: 80650, max: 215400 },
    { rate: 0.0685, min: 215400, max: 1077550 },
    { rate: 0.0965, min: 1077550, max: 5000000 },
    { rate: 0.103, min: 5000000, max: 25000000 },
    { rate: 0.109, min: 25000000, max: Infinity },
  ],
  IL: [{ rate: 0.0495, min: 0, max: Infinity }],
  MA: [{ rate: 0.05, min: 0, max: Infinity }],
  NJ: [
    { rate: 0.014, min: 0, max: 20000 },
    { rate: 0.0175, min: 20000, max: 35000 },
    { rate: 0.035, min: 35000, max: 40000 },
    { rate: 0.05525, min: 40000, max: 75000 },
    { rate: 0.0637, min: 75000, max: 500000 },
    { rate: 0.0897, min: 500000, max: 1000000 },
    { rate: 0.1075, min: 1000000, max: Infinity },
  ],
};

/**
 * Calculate state income tax for a given state, income, and filing status.
 */
export function calculateStateTax(
  state: string,
  stateTaxableIncome: number,
  _filingStatus: FilingStatus
): number {
  const brackets = STATE_TAX_RATES[state.toUpperCase()];
  if (!brackets) return 0; // No state income tax (TX, FL, WA, etc.)
  return applyBracketsInternal(Math.max(0, stateTaxableIncome), brackets);
}

// ── Refund / Balance Due ──────────────────────────────────────────────────────

/**
 * Calculate refund amount (positive) or balance due (negative).
 */
export function calculateRefund(
  totalTax: number,
  withholding: number,
  credits: number
): number {
  return roundToDollar(withholding + credits - totalTax);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundToDollar(amount: number): number {
  return Math.round(amount * 100) / 100;
}
