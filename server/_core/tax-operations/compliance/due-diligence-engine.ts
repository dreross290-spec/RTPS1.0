// ── Types ─────────────────────────────────────────────────────────────────────

export interface DueDiligenceResult {
  passed: boolean;
  issues: DueDiligenceIssue[];
}

export interface DueDiligenceIssue {
  code: string;
  severity: "error" | "warning";
  description: string;
  recommendation: string;
}

export interface EITCCheckData {
  filingStatus: string;
  agi: number;
  earnedIncome: number;
  investmentIncome?: number;
  qualifyingChildren: number;
  claimedEITC: number;
}

export interface DeductionData {
  charitableContributions?: number;
  nonCashContributions?: number;
  homeOfficeSquareFeet?: number;
  totalHomeSquareFeet?: number;
  homeOfficeBusiness?: string;
  [key: string]: unknown;
}

// ── EITC Due Diligence ────────────────────────────────────────────────────────

/**
 * Run EITC due diligence checks (required by IRC §6695(g)).
 */
export function checkEITC(data: EITCCheckData): DueDiligenceResult {
  const issues: DueDiligenceIssue[] = [];

  // 2024 EITC AGI limits
  const limits: Record<number, { single: number; joint: number }> = {
    0: { single: 18591, joint: 25511 },
    1: { single: 49084, joint: 56004 },
    2: { single: 55768, joint: 62698 },
    3: { single: 59899, joint: 66819 },
  };

  const numChildren = Math.min(data.qualifyingChildren, 3);
  const limit = limits[numChildren];

  const isJoint =
    data.filingStatus === "married_filing_jointly";
  const agiLimit = isJoint ? limit.joint : limit.single;

  if (data.agi > agiLimit) {
    issues.push({
      code: "EITC001",
      severity: "error",
      description: "AGI exceeds EITC threshold.",
      recommendation: "Remove EITC claim — taxpayer is not eligible based on AGI.",
    });
  }

  if (data.filingStatus === "married_filing_separately") {
    issues.push({
      code: "EITC002",
      severity: "error",
      description: "EITC not allowed for Married Filing Separately.",
      recommendation: "Remove EITC claim.",
    });
  }

  if ((data.investmentIncome ?? 0) > 11600) {
    issues.push({
      code: "EITC003",
      severity: "error",
      description: "Investment income exceeds EITC limit ($11,600 for 2024).",
      recommendation: "Remove EITC claim — investment income disqualifies taxpayer.",
    });
  }

  if (data.earnedIncome <= 0) {
    issues.push({
      code: "EITC004",
      severity: "error",
      description: "No earned income reported but EITC claimed.",
      recommendation: "Verify earned income sources.",
    });
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Validate Form 8867 (Paid Preparer's Due Diligence) requirements.
 */
export function validateForm8867(returnData: Record<string, unknown>): DueDiligenceResult {
  const issues: DueDiligenceIssue[] = [];
  const credits = returnData.credits as Record<string, number> | undefined;

  if (credits?.eitc ?? 0 > 0) {
    if (!returnData.eitcKnowledgeChecklist) {
      issues.push({
        code: "8867001",
        severity: "error",
        description: "Form 8867 EITC knowledge checklist not completed.",
        recommendation: "Complete all EITC knowledge questions on Form 8867.",
      });
    }
  }

  if ((credits?.childTaxCredit ?? 0) > 0) {
    if (!returnData.ctcDueDiligenceDocs) {
      issues.push({
        code: "8867002",
        severity: "warning",
        description: "CTC due diligence documentation not recorded.",
        recommendation: "Document the knowledge-based questions for CTC.",
      });
    }
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Check charitable contribution deductions for compliance.
 */
export function checkCharitableContributions(deductions: DeductionData): DueDiligenceResult {
  const issues: DueDiligenceIssue[] = [];
  const total = deductions.charitableContributions ?? 0;
  const nonCash = deductions.nonCashContributions ?? 0;

  // Non-cash over $500 requires Form 8283
  if (nonCash > 500) {
    issues.push({
      code: "CHR001",
      severity: "warning",
      description: "Non-cash charitable contributions over $500 require Form 8283.",
      recommendation: "Ensure Form 8283 is included with the return.",
    });
  }

  // Single item over $5,000 requires qualified appraisal
  if (nonCash > 5000) {
    issues.push({
      code: "CHR002",
      severity: "error",
      description: "Non-cash contributions over $5,000 require a qualified appraisal.",
      recommendation: "Obtain and attach a qualified appraisal to the return.",
    });
  }

  // Donations over 60% of AGI require carryover
  const agi = (deductions.agi as number) ?? 0;
  if (agi > 0 && total > agi * 0.6) {
    issues.push({
      code: "CHR003",
      severity: "warning",
      description: "Charitable contributions exceed 60% of AGI; excess must be carried over.",
      recommendation: "Calculate 5-year carryforward on Schedule A.",
    });
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Check home office deduction for compliance.
 */
export function checkHomeOffice(deductions: DeductionData): DueDiligenceResult {
  const issues: DueDiligenceIssue[] = [];

  if (!deductions.homeOfficeBusiness) {
    issues.push({
      code: "HO001",
      severity: "error",
      description: "Home office deduction requires identification of the associated business.",
      recommendation: "Link the home office to a Schedule C or other business.",
    });
  }

  if (!deductions.homeOfficeSquareFeet || !deductions.totalHomeSquareFeet) {
    issues.push({
      code: "HO002",
      severity: "error",
      description: "Home office square footage not provided.",
      recommendation: "Enter office sq ft and total home sq ft for Form 8829.",
    });
  }

  const usagePercent =
    (deductions.homeOfficeSquareFeet ?? 0) /
    (deductions.totalHomeSquareFeet ?? 1);

  if (usagePercent > 0.5) {
    issues.push({
      code: "HO003",
      severity: "warning",
      description: "Home office claimed as >50% of total home space — verify with client.",
      recommendation: "Document exclusive business use to support the deduction.",
    });
  }

  return { passed: issues.length === 0, issues };
}
