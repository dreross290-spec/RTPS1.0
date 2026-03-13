import { db } from "@server/lib/db";
import { taxReturns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { calculateFederalTax, calculateSETax, calculateRefund } from "@server/_core/tax-operations/preparation/tax-calculator";
import { calculateAGI, calculateFederalTaxableIncome } from "@server/_core/tax-operations/preparation/agi-calculator";
import { calculateEITC, calculateChildTaxCredit } from "@server/lib/tax-rules/credit-rules";
import type { FilingStatus } from "@server/lib/schemas/tax-payload";

/**
 * Process all returns queued for calculation.
 */
export async function processCalculationQueue(): Promise<void> {
  const pending = await db
    .select()
    .from(taxReturns)
    .where(eq(taxReturns.status, "calculation_pending"));

  console.log(`[TaxCalcWorker] Processing ${pending.length} returns...`);

  for (const ret of pending) {
    try {
      await calculateReturn(ret.returnId);
    } catch (err) {
      console.error(
        `[TaxCalcWorker] Failed to calculate return ${ret.returnId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

/**
 * Perform full tax calculation for a return and persist the results.
 */
export async function calculateReturn(returnId: string): Promise<void> {
  const ret = await db.query.taxReturns.findFirst({
    where: eq(taxReturns.returnId, returnId),
  });

  if (!ret) throw new Error(`Return not found: ${returnId}`);

  const draftData = (ret.draftData ?? {}) as Record<string, unknown>;
  const taxYear = ret.taxYear as 2024 | 2025;
  const filingStatus = (ret.filingStatus ?? "single") as FilingStatus;

  const income = draftData.income as Record<string, number> | undefined;
  const deductions = draftData.deductions as Record<string, unknown> | undefined;

  const incomeData = {
    wages: income?.wages ?? 0,
    interest: income?.interest ?? 0,
    dividends: income?.dividends ?? 0,
    businessIncome: income?.businessIncome ?? 0,
    capitalGains: income?.capitalGains ?? 0,
    rentalIncome: income?.rentalIncome ?? 0,
    socialSecurity: income?.socialSecurity ?? 0,
    pensionIncome: income?.pensionIncome ?? 0,
    otherIncome: income?.otherIncome ?? 0,
    studentLoanInterest: deductions?.studentLoanInterest as number ?? 0,
    iraDeduction: deductions?.iraContributions as number ?? 0,
    educatorExpenses: deductions?.educatorExpenses as number ?? 0,
    hsaDeduction: deductions?.hsaContributions as number ?? 0,
    alimonyPaid: deductions?.alimonyPaid as number ?? 0,
  };

  const agi = calculateAGI(incomeData);

  // Self-employment tax
  const seTax = calculateSETax(income?.businessIncome ?? 0);

  const deductionData = {
    deductionType: (deductions?.deductionType as "standard" | "itemized") ?? "standard",
    mortgageInterest: deductions?.mortgageInterest as number ?? 0,
    charitableContributions: deductions?.charitableContributions as number ?? 0,
    stateTaxesPaid: deductions?.stateTaxesPaid as number ?? 0,
    medicalExpenses: deductions?.medicalExpenses as number ?? 0,
  };

  const taxableIncome = calculateFederalTaxableIncome(agi, deductionData, taxYear, filingStatus);
  const federalTax = calculateFederalTax(taxableIncome, filingStatus, taxYear);

  const dependents = (draftData.dependents as Array<{ dob: string }>) ?? [];
  const qualifyingChildren = dependents.filter((d) => {
    const age = (new Date().getFullYear() - new Date(d.dob).getFullYear());
    return age < 17;
  }).length;

  const eitc = calculateEITC({
    earnedIncome: income?.wages ?? 0 + (income?.businessIncome ?? 0),
    agi,
    filingStatus,
    qualifyingChildren,
    taxYear,
  });

  const { childTaxCredit } = calculateChildTaxCredit(qualifyingChildren, agi, filingStatus, taxYear);

  const totalCredits = eitc + childTaxCredit;
  const withholding = (income?.federalWithholding as number) ?? 0;
  const totalTax = Math.max(0, federalTax + seTax.seTax - totalCredits);
  const refund = calculateRefund(totalTax, withholding, 0);

  const calculations = {
    agi,
    taxableIncome,
    federalTax,
    seTax: seTax.seTax,
    seTaxDeduction: seTax.deductiblePortion,
    eitc,
    childTaxCredit,
    totalCredits,
    totalTax,
    withholding,
    refundOrOwed: refund,
    calculatedAt: new Date().toISOString(),
  };

  await db
    .update(taxReturns)
    .set({
      calculations,
      status: "calculated",
      refundAmount: refund > 0 ? refund.toFixed(2) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(taxReturns.returnId, returnId));
}
