import type { TaxBracket } from "@server/lib/constants/tax-brackets";

/**
 * Apply a set of tax brackets to a given income amount.
 */
export function applyBrackets(
  income: number,
  brackets: TaxBracket[]
): number {
  let tax = 0;
  const taxable = Math.max(0, income);

  for (const bracket of brackets) {
    if (taxable <= bracket.min) break;
    const amount = Math.min(taxable, bracket.max) - bracket.min;
    tax += amount * bracket.rate;
  }

  return roundToDollar(tax);
}

/**
 * Calculate a phase-out reduction.
 *
 * @param amount - The original credit/deduction amount
 * @param agi - The taxpayer's AGI
 * @param threshold - The AGI threshold where phase-out begins
 * @param range - The total range over which the amount phases to zero
 * @returns The reduced amount after phase-out
 */
export function calculatePhaseOut(
  amount: number,
  agi: number,
  threshold: number,
  range: number
): number {
  if (agi <= threshold || range <= 0) return amount;

  const excess = agi - threshold;
  const reductionFraction = Math.min(excess / range, 1);
  return Math.max(0, roundToDollar(amount * (1 - reductionFraction)));
}

/**
 * Calculate a stepped phase-out that reduces by a fixed amount per $2,500 increment.
 *
 * Used for Child Tax Credit, EITC, etc.
 */
export function calculateSteppedPhaseOut(
  amount: number,
  agi: number,
  threshold: number,
  reductionPerStep: number,
  stepSize: number = 2500
): number {
  if (agi <= threshold) return amount;

  const excess = agi - threshold;
  const steps = Math.ceil(excess / stepSize);
  const reduction = steps * reductionPerStep;

  return Math.max(0, roundToDollar(amount - reduction));
}

/**
 * Round a currency value to the nearest dollar (two decimal places).
 */
export function roundToDollar(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Calculate the marginal tax rate for a given income and filing status.
 */
export function getMarginalRate(
  income: number,
  brackets: TaxBracket[]
): number {
  const taxable = Math.max(0, income);
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxable > brackets[i].min) {
      return brackets[i].rate;
    }
  }
  return 0;
}

/**
 * Calculate effective tax rate (total tax / taxable income).
 */
export function getEffectiveRate(totalTax: number, taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  return totalTax / taxableIncome;
}
