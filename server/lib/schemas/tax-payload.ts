import { z } from "zod";

// ── Base Types ────────────────────────────────────────────────────────────────

export const FilingStatusSchema = z.enum([
  "single",
  "married_filing_jointly",
  "married_filing_separately",
  "head_of_household",
  "qualifying_widow",
]);

export const PersonalInfoSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  ssn: z.string().optional(), // encrypted at rest
  itin: z.string().optional(),
  dob: z.string(), // ISO date string
  occupation: z.string().optional(),
  filingStatus: FilingStatusSchema,
  address: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string().length(2),
    zip: z.string(),
    country: z.string().default("US"),
  }),
  foreignAddress: z
    .object({
      line1: z.string(),
      city: z.string(),
      province: z.string().optional(),
      postalCode: z.string(),
      country: z.string(),
    })
    .optional(),
  spouseInfo: z
    .object({
      firstName: z.string(),
      lastName: z.string(),
      ssn: z.string().optional(),
      dob: z.string(),
      occupation: z.string().optional(),
    })
    .optional(),
});

export const DependentInfoSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  ssn: z.string().optional(),
  dob: z.string(),
  relationship: z.string(),
  monthsLived: z.number().min(0).max(12),
  income: z.number().min(0).default(0),
  supportPercent: z.number().min(0).max(100).default(100),
  isFullTimeStudent: z.boolean().default(false),
  isDisabled: z.boolean().default(false),
  isQualifyingChild: z.boolean().default(true),
  childCareExpenses: z.number().min(0).default(0),
});

// ── Income ────────────────────────────────────────────────────────────────────

export const W2Schema = z.object({
  employerEIN: z.string(),
  employerName: z.string(),
  wages: z.number(),
  federalWithholding: z.number(),
  socialSecurityWages: z.number(),
  socialSecurityWithholding: z.number(),
  medicareWages: z.number(),
  medicareWithholding: z.number(),
  stateWages: z.record(z.number()).default({}),
  stateWithholding: z.record(z.number()).default({}),
  box12Codes: z.array(z.object({ code: z.string(), amount: z.number() })).default([]),
  box14Items: z.array(z.object({ description: z.string(), amount: z.number() })).default([]),
});

export const Form1099NECSchema = z.object({
  payerName: z.string(),
  payerTIN: z.string(),
  nonemployeeCompensation: z.number(),
  federalWithholding: z.number().default(0),
});

export const Form1099MISCSchema = z.object({
  payerName: z.string(),
  payerTIN: z.string(),
  rents: z.number().default(0),
  royalties: z.number().default(0),
  otherIncome: z.number().default(0),
  federalWithholding: z.number().default(0),
  medicalPayments: z.number().default(0),
  nonQualifiedDeferredComp: z.number().default(0),
});

export const Form1099INTSchema = z.object({
  payerName: z.string(),
  payerTIN: z.string(),
  interestIncome: z.number(),
  earlyWithdrawalPenalty: z.number().default(0),
  usSavingsBondInterest: z.number().default(0),
  federalWithholding: z.number().default(0),
  investmentExpenses: z.number().default(0),
  taxExemptInterest: z.number().default(0),
});

export const Form1099DIVSchema = z.object({
  payerName: z.string(),
  payerTIN: z.string(),
  totalOrdinaryDividends: z.number(),
  qualifiedDividends: z.number().default(0),
  totalCapitalGainDistributions: z.number().default(0),
  unrecaptured1250Gain: z.number().default(0),
  federalWithholding: z.number().default(0),
  taxExemptDividends: z.number().default(0),
});

export const Form1099RSchema = z.object({
  payerName: z.string(),
  payerTIN: z.string(),
  grossDistribution: z.number(),
  taxableAmount: z.number(),
  taxableAmountNotDetermined: z.boolean().default(false),
  distributionCode: z.string(),
  federalWithholding: z.number().default(0),
  isIRA: z.boolean().default(false),
  employeeContributions: z.number().default(0),
});

export const K1Schema = z.object({
  partnershipEIN: z.string(),
  partnershipName: z.string(),
  partnerType: z.enum(["general", "limited", "llc"]),
  ordinaryIncome: z.number().default(0),
  rentalIncome: z.number().default(0),
  interestIncome: z.number().default(0),
  dividendIncome: z.number().default(0),
  capitalGains: z.record(z.number()).default({}),
  deductions: z.record(z.number()).default({}),
  credits: z.record(z.number()).default({}),
  taxYear: z.number(),
});

export const IncomeDataSchema = z.object({
  w2s: z.array(W2Schema).default([]),
  form1099NECs: z.array(Form1099NECSchema).default([]),
  form1099MISCs: z.array(Form1099MISCSchema).default([]),
  form1099INTs: z.array(Form1099INTSchema).default([]),
  form1099DIVs: z.array(Form1099DIVSchema).default([]),
  form1099Rs: z.array(Form1099RSchema).default([]),
  k1s: z.array(K1Schema).default([]),
  socialSecurity: z.number().default(0),
  alimonyReceived: z.number().default(0),
  gamblingWinnings: z.number().default(0),
  otherIncome: z.number().default(0),
});

export const BusinessIncomeSchema = z.object({
  businessName: z.string(),
  ein: z.string().optional(),
  businessType: z.enum(["sole_prop", "partnership", "s_corp", "c_corp", "llc"]),
  grossReceipts: z.number(),
  expenses: z.record(z.number()),
  netProfit: z.number(),
  homeOffice: z
    .object({
      squareFeet: z.number(),
      totalHomeSqFt: z.number(),
      directExpenses: z.number().default(0),
      indirectExpenses: z.number().default(0),
    })
    .optional(),
  vehicle: z
    .object({
      businessMiles: z.number(),
      totalMiles: z.number(),
      method: z.enum(["standard", "actual"]),
    })
    .optional(),
});

export const DeductionsSchema = z.object({
  deductionType: z.enum(["standard", "itemized"]),
  mortgageInterest: z.number().default(0),
  charitableContributions: z.number().default(0),
  nonCashCharitable: z.number().default(0),
  stateTaxesPaid: z.number().default(0),
  localTaxesPaid: z.number().default(0),
  realEstateTaxes: z.number().default(0),
  medicalExpenses: z.number().default(0),
  studentLoanInterest: z.number().default(0),
  educatorExpenses: z.number().default(0),
  hsaContributions: z.number().default(0),
  iraContributions: z.number().default(0),
  alimonyPaid: z.number().default(0),
  casualtyLosses: z.number().default(0),
});

export const CreditsSchema = z.object({
  childTaxCredit: z.number().default(0),
  additionalChildTaxCredit: z.number().default(0),
  eitc: z.number().default(0),
  childCareCredit: z.number().default(0),
  americanOpportunityCredit: z.number().default(0),
  lifetimeLearningCredit: z.number().default(0),
  retirementSaverCredit: z.number().default(0),
  premiumTaxCredit: z.number().default(0),
  energyCredits: z.number().default(0),
  foreignTaxCredit: z.number().default(0),
});

export const StateInfoSchema = z.object({
  state: z.string().length(2),
  residencyStatus: z.enum(["resident", "part_year", "nonresident"]),
  residencyStartDate: z.string().optional(),
  residencyEndDate: z.string().optional(),
  income: z.number(),
  deductions: z.record(z.number()),
  credits: z.record(z.number()),
  withholding: z.number().default(0),
});

export const CanonicalTaxPayloadSchema = z.object({
  returnId: z.string().uuid().optional(),
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  taxYear: z.number().int().min(2020).max(2030),
  returnType: z.string(),
  filingStatus: FilingStatusSchema.optional(),
  personalInfo: PersonalInfoSchema,
  dependents: z.array(DependentInfoSchema).default([]),
  income: IncomeDataSchema,
  businessIncome: z.array(BusinessIncomeSchema).default([]),
  deductions: DeductionsSchema,
  credits: CreditsSchema,
  states: z.array(StateInfoSchema).default([]),
  signatures: z
    .object({
      taxpayerPin: z.string().optional(),
      spousePin: z.string().optional(),
      preparerPin: z.string().optional(),
      dateSigned: z.string().optional(),
    })
    .optional(),
  thirdPartyDesignee: z
    .object({
      name: z.string(),
      phone: z.string(),
      pin: z.string(),
    })
    .optional(),
});

// ── Exported Types ────────────────────────────────────────────────────────────

export type FilingStatus = z.infer<typeof FilingStatusSchema>;
export type PersonalInfo = z.infer<typeof PersonalInfoSchema>;
export type DependentInfo = z.infer<typeof DependentInfoSchema>;
export type IncomeData = z.infer<typeof IncomeDataSchema>;
export type BusinessIncome = z.infer<typeof BusinessIncomeSchema>;
export type Deductions = z.infer<typeof DeductionsSchema>;
export type Credits = z.infer<typeof CreditsSchema>;
export type StateInfo = z.infer<typeof StateInfoSchema>;
export type CanonicalTaxPayload = z.infer<typeof CanonicalTaxPayloadSchema>;
