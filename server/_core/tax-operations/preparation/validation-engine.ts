import type { FilingStatus } from "./tax-calculator";

// ── Validation Types ──────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
}

export interface ValidationWarning {
  code: string;
  field: string;
  message: string;
}

export interface DependentData {
  firstName: string;
  lastName: string;
  ssn: string;
  dob: string;
  relationship: string;
  monthsLived: number;
  income: number;
  support: number;
  isStudent: boolean;
  isDisabled: boolean;
}

export interface ReturnData {
  taxYear: number;
  filingStatus: FilingStatus;
  agi: number;
  taxableIncome: number;
  totalTax: number;
  withholding: number;
  credits: Record<string, number>;
  deductions: Record<string, unknown>;
  dependents: DependentData[];
  income: Record<string, number>;
}

// ── Main Validation Entry Point ───────────────────────────────────────────────

/**
 * Run all validation rules against a completed return payload.
 */
export function validateReturn(returnData: ReturnData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Filing status consistency checks
  checkFilingStatus(returnData, errors, warnings);

  // Income checks
  checkIncome(returnData, errors, warnings);

  // Dependent checks
  returnData.dependents.forEach((dep, idx) => {
    const depResult = validateDependent(dep);
    depResult.errors.forEach((e) =>
      errors.push({ ...e, field: `dependents[${idx}].${e.field}` })
    );
    depResult.warnings.forEach((w) =>
      warnings.push({ ...w, field: `dependents[${idx}].${w.field}` })
    );
  });

  // Credit eligibility
  const creditResult = validateCredits(returnData.credits, returnData.filingStatus, returnData.agi);
  errors.push(...creditResult.errors);
  warnings.push(...creditResult.warnings);

  // Withholding reconciliation
  const withResult = validateWithholding(returnData.withholding, returnData);
  errors.push(...withResult.errors);
  warnings.push(...withResult.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

// ── Dependent Validation ──────────────────────────────────────────────────────

/**
 * Validate a dependent record.
 */
export function validateDependent(dependent: DependentData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!dependent.ssn || !/^\d{3}-\d{2}-\d{4}$/.test(dependent.ssn)) {
    errors.push({ code: "DEP001", field: "ssn", message: "Dependent SSN is invalid or missing." });
  }

  if (!dependent.dob) {
    errors.push({ code: "DEP002", field: "dob", message: "Dependent date of birth is required." });
  }

  const age = calculateAge(dependent.dob);

  // Qualifying child: under 19, or under 24 and full-time student
  const isQualifyingChild =
    age < 19 || (age < 24 && dependent.isStudent);

  // Qualifying relative: gross income under $5,050 (2024) and > 50% support
  const isQualifyingRelative =
    dependent.income < 5050 && dependent.support > 0.5;

  if (!isQualifyingChild && !isQualifyingRelative) {
    warnings.push({
      code: "DEP003",
      field: "relationship",
      message: "Dependent may not meet qualifying child or qualifying relative tests.",
    });
  }

  if (dependent.monthsLived < 6 && !isQualifyingRelative) {
    errors.push({
      code: "DEP004",
      field: "monthsLived",
      message: "Qualifying child must live with taxpayer for more than 6 months.",
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Credit Validation ─────────────────────────────────────────────────────────

/**
 * Validate credit eligibility.
 */
export function validateCredits(
  credits: Record<string, number>,
  filingStatus: FilingStatus,
  agi: number
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Child Tax Credit: AGI limits (2024)
  const ctcAgiLimit =
    filingStatus === "married_filing_jointly" ? 400000 : 200000;
  if ((credits.childTaxCredit ?? 0) > 0 && agi > ctcAgiLimit) {
    warnings.push({
      code: "CRD001",
      field: "childTaxCredit",
      message: `Child Tax Credit phases out above $${ctcAgiLimit.toLocaleString()} AGI.`,
    });
  }

  // EITC: not available for MFS
  if ((credits.eitc ?? 0) > 0 && filingStatus === "married_filing_separately") {
    errors.push({
      code: "CRD002",
      field: "eitc",
      message: "Earned Income Tax Credit is not available for Married Filing Separately.",
    });
  }

  // American Opportunity Credit: max $2,500
  if ((credits.aoc ?? 0) > 2500) {
    errors.push({
      code: "CRD003",
      field: "aoc",
      message: "American Opportunity Credit cannot exceed $2,500.",
    });
  }

  // Lifetime Learning Credit: max $2,000
  if ((credits.llc ?? 0) > 2000) {
    errors.push({
      code: "CRD004",
      field: "llc",
      message: "Lifetime Learning Credit cannot exceed $2,000.",
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Withholding Validation ────────────────────────────────────────────────────

/**
 * Validate that withholding amounts reconcile with reported income.
 */
export function validateWithholding(
  withholding: number,
  taxData: ReturnData
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (withholding < 0) {
    errors.push({
      code: "WH001",
      field: "withholding",
      message: "Total withholding cannot be negative.",
    });
  }

  // Unusual withholding: > 50% of AGI
  if (taxData.agi > 0 && withholding > taxData.agi * 0.5) {
    warnings.push({
      code: "WH002",
      field: "withholding",
      message: "Withholding exceeds 50% of AGI — please verify all withholding documents.",
    });
  }

  // Underpayment penalty risk: withholding < 90% of tax
  const minRequiredWithholding = taxData.totalTax * 0.9;
  if (withholding < minRequiredWithholding && taxData.totalTax > 1000) {
    warnings.push({
      code: "WH003",
      field: "withholding",
      message: "Withholding may be insufficient; underpayment penalty may apply.",
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Private helpers ───────────────────────────────────────────────────────────

function checkFilingStatus(
  returnData: ReturnData,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (
    returnData.filingStatus === "head_of_household" &&
    returnData.dependents.length === 0
  ) {
    warnings.push({
      code: "FS001",
      field: "filingStatus",
      message: "Head of Household requires a qualifying person.",
    });
  }
}

function checkIncome(
  returnData: ReturnData,
  errors: ValidationError[],
  _warnings: ValidationWarning[]
): void {
  if ((returnData.income.wages ?? 0) < 0) {
    errors.push({
      code: "INC001",
      field: "income.wages",
      message: "Wage income cannot be negative.",
    });
  }
}

function calculateAge(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
