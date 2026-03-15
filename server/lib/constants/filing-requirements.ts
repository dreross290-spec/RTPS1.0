// ── Filing Thresholds 2024 ────────────────────────────────────────────────────

export interface FilingThreshold {
  filingStatus: string;
  age: "under65" | "65orOlder";
  grossIncomeThreshold: number;
}

export const FEDERAL_FILING_THRESHOLDS_2024: FilingThreshold[] = [
  { filingStatus: "single", age: "under65", grossIncomeThreshold: 14600 },
  { filingStatus: "single", age: "65orOlder", grossIncomeThreshold: 16550 },
  { filingStatus: "married_filing_jointly", age: "under65", grossIncomeThreshold: 29200 },
  { filingStatus: "married_filing_jointly", age: "65orOlder", grossIncomeThreshold: 30750 },
  { filingStatus: "married_filing_separately", age: "under65", grossIncomeThreshold: 5 },
  { filingStatus: "married_filing_separately", age: "65orOlder", grossIncomeThreshold: 5 },
  { filingStatus: "head_of_household", age: "under65", grossIncomeThreshold: 21900 },
  { filingStatus: "head_of_household", age: "65orOlder", grossIncomeThreshold: 23850 },
  { filingStatus: "qualifying_widow", age: "under65", grossIncomeThreshold: 29200 },
  { filingStatus: "qualifying_widow", age: "65orOlder", grossIncomeThreshold: 30750 },
];

// ── Supported Return Types ────────────────────────────────────────────────────

export interface ReturnTypeInfo {
  formCode: string;
  description: string;
  entityType: "individual" | "business" | "estate" | "trust";
  supported: boolean;
}

export const RETURN_TYPES: ReturnTypeInfo[] = [
  { formCode: "1040", description: "U.S. Individual Income Tax Return", entityType: "individual", supported: true },
  { formCode: "1040-SR", description: "U.S. Tax Return for Seniors", entityType: "individual", supported: true },
  { formCode: "1040-NR", description: "U.S. Nonresident Alien Income Tax Return", entityType: "individual", supported: true },
  { formCode: "1040-X", description: "Amended U.S. Individual Income Tax Return", entityType: "individual", supported: true },
  { formCode: "1041", description: "U.S. Income Tax Return for Estates and Trusts", entityType: "estate", supported: true },
  { formCode: "1065", description: "U.S. Return of Partnership Income", entityType: "business", supported: true },
  { formCode: "1120", description: "U.S. Corporation Income Tax Return", entityType: "business", supported: true },
  { formCode: "1120-S", description: "U.S. Income Tax Return for an S Corporation", entityType: "business", supported: true },
  { formCode: "990", description: "Return of Organization Exempt From Income Tax", entityType: "trust", supported: false },
];

// ── Schedule Requirements ─────────────────────────────────────────────────────

export interface ScheduleRequirement {
  schedule: string;
  triggerCondition: string;
  description: string;
}

export const SCHEDULE_REQUIREMENTS: ScheduleRequirement[] = [
  { schedule: "Schedule A", triggerCondition: "itemized_deductions", description: "Itemized Deductions" },
  { schedule: "Schedule B", triggerCondition: "interest_or_dividend_over_1500", description: "Interest and Ordinary Dividends" },
  { schedule: "Schedule C", triggerCondition: "self_employment_income", description: "Profit or Loss From Business" },
  { schedule: "Schedule D", triggerCondition: "capital_gains_or_losses", description: "Capital Gains and Losses" },
  { schedule: "Schedule E", triggerCondition: "rental_income_or_k1", description: "Supplemental Income and Loss" },
  { schedule: "Schedule F", triggerCondition: "farm_income", description: "Profit or Loss From Farming" },
  { schedule: "Schedule H", triggerCondition: "household_employee", description: "Household Employment Taxes" },
  { schedule: "Schedule SE", triggerCondition: "self_employment_income_over_400", description: "Self-Employment Tax" },
  { schedule: "Schedule 1", triggerCondition: "additional_income_adjustments", description: "Additional Income and Adjustments" },
  { schedule: "Schedule 2", triggerCondition: "additional_taxes", description: "Additional Taxes" },
  { schedule: "Schedule 3", triggerCondition: "additional_credits_payments", description: "Additional Credits and Payments" },
  { schedule: "Form 2441", triggerCondition: "child_care_credit", description: "Child and Dependent Care Expenses" },
  { schedule: "Form 8812", triggerCondition: "child_tax_credit", description: "Credits for Qualifying Children" },
  { schedule: "Form 8863", triggerCondition: "education_credits", description: "Education Credits" },
  { schedule: "Form 8867", triggerCondition: "eitc_ctc_aoc_hoh", description: "Paid Preparer Due Diligence" },
  { schedule: "Form 8829", triggerCondition: "home_office", description: "Expenses for Business Use of Your Home" },
  { schedule: "Form 4562", triggerCondition: "depreciation", description: "Depreciation and Amortization" },
  { schedule: "Form 6251", triggerCondition: "amt", description: "Alternative Minimum Tax" },
];
