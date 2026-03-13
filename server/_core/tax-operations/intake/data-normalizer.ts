import { normalizeIncomeData, type NormalizedIncomeDocument } from "./form-parser";
import type { CanonicalTaxPayload } from "@server/lib/schemas/tax-payload";

export interface IntakeData {
  returnId: string;
  clientId: string;
  accountId: string;
  taxYear: number;
  personalInfo: Record<string, unknown>;
  documents: Array<{ type: string; data: Record<string, unknown> }>;
  interviewAnswers: Array<{ section: string; questionKey: string; answer: unknown }>;
}

/**
 * Convert raw intake data into a fully-typed canonical tax payload.
 */
export function normalizeToCanonical(intakeData: IntakeData): Partial<CanonicalTaxPayload> {
  const answers = buildAnswerMap(intakeData.interviewAnswers);
  const income = normalizeIncomeData(intakeData.documents);

  return {
    taxYear: intakeData.taxYear,
    returnType: "1040",
    personalInfo: buildPersonalInfo(intakeData.personalInfo, answers),
    income: buildIncome(income, answers),
    deductions: buildDeductions(answers),
    credits: buildCredits(answers),
    states: detectMultiState(intakeData).map((state) => ({
      state,
      residencyStatus: "resident",
      income: allocateIncomeForState(income, state),
      deductions: {},
      credits: {},
    })),
  };
}

/**
 * Detect whether the return requires filings in multiple states.
 */
export function detectMultiState(intakeData: IntakeData): string[] {
  const stateSet = new Set<string>();

  // State of residence
  const answerMap = answers(intakeData);
  const residenceState = String(
    intakeData.personalInfo.state ?? answerMap["personal.state"] ?? ""
  );
  if (residenceState) stateSet.add(residenceState.toUpperCase());

  // States from W-2 withholding
  intakeData.documents.forEach((doc) => {
    if (doc.type === "w2") {
      const stateWages = (doc.data.stateWages as Record<string, number>) ?? {};
      Object.keys(stateWages).forEach((s) => stateSet.add(s.toUpperCase()));
    }
  });

  // States from interview answers
  const workState = answers(intakeData)["work.stateOfEmployment"];
  if (workState) stateSet.add(String(workState).toUpperCase());

  const movedFromState = answers(intakeData)["residency.movedFromState"];
  if (movedFromState) stateSet.add(String(movedFromState).toUpperCase());

  // TX and FL have no income tax — filter if desired
  return Array.from(stateSet).filter(Boolean);
}

/**
 * Determine the taxpayer's residency status for each detected state.
 */
export function calculateResidency(
  intakeData: IntakeData
): Record<string, "resident" | "part_year" | "nonresident"> {
  const result: Record<string, "resident" | "part_year" | "nonresident"> = {};
  const states = detectMultiState(intakeData);
  const primaryState = String(intakeData.personalInfo.state ?? "").toUpperCase();
  const movedDate = answers(intakeData)["residency.moveDate"];

  states.forEach((state) => {
    if (state === primaryState) {
      result[state] = movedDate ? "part_year" : "resident";
    } else {
      result[state] = "nonresident";
    }
  });

  return result;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function answers(
  intakeData: IntakeData
): Record<string, unknown> {
  return buildAnswerMap(intakeData.interviewAnswers);
}

function buildAnswerMap(
  interviewAnswers: Array<{ section: string; questionKey: string; answer: unknown }>
): Record<string, unknown> {
  return Object.fromEntries(
    interviewAnswers.map((a) => [`${a.section}.${a.questionKey}`, a.answer])
  );
}

function buildPersonalInfo(
  personalInfo: Record<string, unknown>,
  answers: Record<string, unknown>
): Record<string, unknown> {
  return {
    firstName: personalInfo.firstName ?? answers["personal.firstName"],
    lastName: personalInfo.lastName ?? answers["personal.lastName"],
    ssn: personalInfo.ssnEncrypted,
    dob: personalInfo.dob,
    filingStatus: personalInfo.filingStatus ?? answers["personal.filingStatus"],
    address: {
      line1: personalInfo.addressLine1,
      line2: personalInfo.addressLine2,
      city: personalInfo.city,
      state: personalInfo.state,
      zip: personalInfo.zip,
    },
  };
}

function buildIncome(
  income: NormalizedIncomeDocument[],
  answers: Record<string, unknown>
): Record<string, unknown> {
  const totalWages = income
    .filter((d) => d.sourceType === "w2")
    .reduce((sum, d) => sum + d.grossAmount, 0);

  const totalInterest = income
    .filter((d) => d.sourceType === "1099-INT")
    .reduce((sum, d) => sum + d.grossAmount, 0);

  const totalDividends = income
    .filter((d) => d.sourceType === "1099-DIV")
    .reduce((sum, d) => sum + d.grossAmount, 0);

  return {
    wages: totalWages,
    interest: totalInterest,
    dividends: totalDividends,
    businessIncome: toNumber(answers["business.netProfit"]),
    rentalIncome: toNumber(answers["rental.netIncome"]),
    documents: income,
  };
}

function buildDeductions(answers: Record<string, unknown>): Record<string, unknown> {
  return {
    deductionType: answers["deductions.type"] ?? "standard",
    mortgageInterest: toNumber(answers["deductions.mortgageInterest"]),
    charitableContributions: toNumber(answers["deductions.charitable"]),
    stateTaxesPaid: toNumber(answers["deductions.stateTaxes"]),
    medicalExpenses: toNumber(answers["deductions.medical"]),
    studentLoanInterest: toNumber(answers["deductions.studentLoan"]),
  };
}

function buildCredits(answers: Record<string, unknown>): Record<string, unknown> {
  return {
    childTaxCredit: toNumber(answers["credits.childTaxCredit"]),
    eitc: toNumber(answers["credits.eitc"]),
    childCareCredit: toNumber(answers["credits.childCare"]),
    educationCredit: toNumber(answers["credits.education"]),
  };
}

function allocateIncomeForState(
  income: NormalizedIncomeDocument[],
  state: string
): number {
  return income.reduce((sum, doc) => {
    const stateAlloc = doc.stateAllocations.find((a) => a.state === state);
    return sum + (stateAlloc?.amount ?? 0);
  }, 0);
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}
