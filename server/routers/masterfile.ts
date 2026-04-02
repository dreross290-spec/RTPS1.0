/**
 * IRS Masterfile Simulation Router
 * tRPC procedures for IRS return processing simulation, account transcripts,
 * DIF score analysis, identity validation, W&I verification, and MEF pre-transmission.
 *
 * Fix: import name corrected from `calculateAvalonV3` (non-existent) to `calculateTax`
 * (the actual export from ../avalon-engine-v3).
 */
import { createTRPCRouter, protectedProcedure } from "./trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  runMasterfileSimulation,
  getNoticeInfo,
  IRS_NOTICE_REGISTRY,
} from "../masterfile-simulator";
import type { WageIncomeRecord } from "../masterfile-simulator";
// ✅ Fixed: was `calculateAvalonV3` (does not exist); correct export is `calculateTax`
import { calculateTax } from "../avalon-engine-v3";

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const WageRecordSchema = z.object({
  formType: z.string(),
  payerName: z.string(),
  payerEIN: z.string(),
  amount: z.number().min(0),
  federalWithheld: z.number().min(0),
  reportedToIRS: z.boolean(),
  matchStatus: z.enum(["MATCH", "MISMATCH", "NOT_FOUND", "PENDING"]),
  discrepancy: z.number().optional(),
});

const TaxProfileSchema = z.object({
  taxYear: z.number().min(2020).max(2027),
  filingStatus: z.enum([
    "single",
    "married_filing_jointly",
    "married_filing_separately",
    "head_of_household",
    "qualifying_surviving_spouse",
  ]),
  grossIncome: z.number().min(0),
  wages: z.number().min(0).default(0),
  selfEmploymentIncome: z.number().min(0).default(0),
  capitalGains: z.number().min(0).default(0),
  qualifiedDividends: z.number().min(0).default(0),
  ordinaryDividends: z.number().min(0).default(0),
  interestIncome: z.number().min(0).default(0),
  rentalIncome: z.number().min(0).default(0),
  otherIncome: z.number().min(0).default(0),
  iraDistributions: z.number().min(0).default(0),
  pensionAnnuity: z.number().min(0).default(0),
  socialSecurityBenefits: z.number().min(0).default(0),
  age: z.number().min(0).max(120).default(35),
  spouseAge: z.number().min(0).max(120).optional(),
  dependents: z.number().min(0).default(0),
  qualifyingChildren: z.number().min(0).default(0),
  childrenUnder17: z.number().min(0).default(0),
  studentLoanInterest: z.number().min(0).default(0),
  iraContributions: z.number().min(0).default(0),
  rothIraContributions: z.number().min(0).default(0),
  hsaContributions: z.number().min(0).default(0),
  selfEmployedHealthInsurance: z.number().min(0).default(0),
  alimonyPaid: z.number().min(0).default(0),
  educatorExpenses: z.number().min(0).default(0),
  capitalLosses: z.number().min(0).default(0),
  charitableCash: z.number().min(0).default(0),
  charitableNonCash: z.number().min(0).default(0),
  mortgageInterest: z.number().min(0).default(0),
  stateLocalTaxes: z.number().min(0).default(0),
  medicalExpenses: z.number().min(0).default(0),
  businessExpenses: z.number().min(0).default(0),
  federalWithheld: z.number().min(0).default(0),
  estimatedTaxPayments: z.number().min(0).default(0),
  earnedIncome: z.number().min(0).default(0),
  isBlind: z.boolean().default(false),
  spouseIsBlind: z.boolean().default(false),
  isFullTimeStudent: z.boolean().default(false),
  hasQualifiedOpportunityZoneInvestment: z.boolean().default(false),
  foreignTaxCredit: z.number().min(0).default(0),
  childCareExpenses: z.number().min(0).default(0),
  americanOpportunityCredit: z.number().min(0).default(0),
  lifetimeLearningCredit: z.number().min(0).default(0),
  retirementSaversCredit: z.number().min(0).default(0),
  energyCredits: z.number().min(0).default(0),
  premiumTaxCredit: z.number().min(0).default(0),
  otherCredits: z.number().min(0).default(0),
  otherTaxes: z.number().min(0).default(0),
  selfEmploymentTaxDeduction: z.boolean().default(true),
  qbiDeduction: z.boolean().default(true),
  useItemized: z.boolean().optional(),
});

// ── Router ────────────────────────────────────────────────────────────────────

export const masterfileRouter = createTRPCRouter({
  /**
   * Run full IRS Masterfile Processing Simulation.
   * Calls the Avalon 3.0 engine first, then passes the result into the
   * masterfile simulator for DIF scoring, identity validation, W&I matching,
   * and MEF pre-transmission checks.
   */
  simulate: protectedProcedure
    .input(
      z.object({
        taxpayerName: z.string().min(1),
        ssnLast4: z.string().length(4),
        dob: z.string(),
        address: z.string(),
        taxProfile: TaxProfileSchema,
        wageRecords: z.array(WageRecordSchema).optional(),
        priorYearAgi: z.number().optional(),
        ipPin: z.string().optional(),
        filingDate: z.string().optional(),
        isAmendment: z.boolean().optional(),
        originalRefund: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // ✅ calculateTax is the correct export name from avalon-engine-v3.ts
        const avalonResult = calculateTax(input.taxProfile);

        const simulation = runMasterfileSimulation({
          taxpayerName: input.taxpayerName,
          ssn: input.ssnLast4,
          dob: input.dob,
          address: input.address,
          taxYear: input.taxProfile.taxYear,
          filingDate: input.filingDate,
          priorYearAgi: input.priorYearAgi,
          ipPin: input.ipPin,
          avalonResult,
          wageRecords: input.wageRecords as WageIncomeRecord[] | undefined,
          isAmendment: input.isAmendment,
          originalRefund: input.originalRefund,
        });

        return { success: true, data: simulation, avalonResult };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Masterfile simulation failed",
          cause: error,
        });
      }
    }),

  /**
   * Look up a single IRS notice from the built-in registry.
   */
  getNoticeInfo: protectedProcedure
    .input(z.object({ noticeNumber: z.string() }))
    .query(async ({ input }) => {
      const info = getNoticeInfo(input.noticeNumber);
      if (!info) {
        return { found: false, info: null };
      }
      return { found: true, info };
    }),

  /**
   * Return a summary list of all IRS notices in the registry.
   */
  listNotices: protectedProcedure.query(async () => {
    return Object.values(IRS_NOTICE_REGISTRY).map((n) => ({
      noticeNumber: n.noticeNumber,
      title: n.title,
      responseDeadlineDays: n.responseDeadlineDays,
      appealRights: n.appealRights,
      irmSection: n.irmSection,
    }));
  }),

  /**
   * Run Avalon 3.0 tax optimisation only (without the full masterfile simulation).
   */
  calculateTax: protectedProcedure
    .input(TaxProfileSchema)
    .mutation(async ({ input }) => {
      try {
        // ✅ calculateTax is the correct export name from avalon-engine-v3.ts
        const result = calculateTax(input);
        return { success: true, data: result };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tax calculation failed",
          cause: error,
        });
      }
    }),
});
