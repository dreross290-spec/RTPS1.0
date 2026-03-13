import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "./trpc";
import { taxReturns, interviewAnswers } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

const INTERVIEW_SECTIONS = [
  "personal",
  "filing_status",
  "dependents",
  "income",
  "deductions",
  "credits",
  "healthcare",
  "state",
  "bank_info",
  "signature",
];

export const intakeFormsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        clientId: z.string().uuid(),
        taxYear: z.number().int().min(2020).max(2030),
        returnType: z.string().default("1040"),
        preparerId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(taxReturns)
        .values({
          accountId: input.accountId,
          clientId: input.clientId,
          preparerId: input.preparerId,
          taxYear: input.taxYear,
          returnType: input.returnType,
          status: "draft",
        })
        .returning({ returnId: taxReturns.returnId });

      return created;
    }),

  getInterviewQuestions: protectedProcedure
    .input(z.object({ section: z.string().optional() }))
    .query(({ input }) => {
      const sections = input.section
        ? INTERVIEW_SECTIONS.filter((s) => s === input.section)
        : INTERVIEW_SECTIONS;

      return sections.map((section) => ({
        section,
        questions: getQuestionsForSection(section),
      }));
    }),

  saveAnswer: protectedProcedure
    .input(
      z.object({
        returnId: z.string().uuid(),
        section: z.string(),
        questionKey: z.string(),
        answer: z.unknown(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Upsert the answer
      const existing = await ctx.db.query.interviewAnswers.findFirst({
        where: and(
          eq(interviewAnswers.returnId, input.returnId),
          eq(interviewAnswers.section, input.section),
          eq(interviewAnswers.questionKey, input.questionKey)
        ),
      });

      if (existing) {
        await ctx.db
          .update(interviewAnswers)
          .set({ answer: input.answer, updatedAt: new Date() })
          .where(eq(interviewAnswers.answerId, existing.answerId));
      } else {
        await ctx.db.insert(interviewAnswers).values({
          returnId: input.returnId,
          section: input.section,
          questionKey: input.questionKey,
          answer: input.answer,
        });
      }

      return { success: true };
    }),
});

function getQuestionsForSection(section: string): Array<{ key: string; label: string; type: string; required: boolean }> {
  const questions: Record<string, Array<{ key: string; label: string; type: string; required: boolean }>> = {
    personal: [
      { key: "firstName", label: "First Name", type: "text", required: true },
      { key: "lastName", label: "Last Name", type: "text", required: true },
      { key: "ssn", label: "Social Security Number", type: "ssn", required: true },
      { key: "dob", label: "Date of Birth", type: "date", required: true },
      { key: "occupation", label: "Occupation", type: "text", required: false },
      { key: "phone", label: "Phone Number", type: "phone", required: false },
    ],
    filing_status: [
      { key: "filingStatus", label: "Filing Status", type: "select", required: true },
      { key: "spouseSSN", label: "Spouse SSN (if MFJ)", type: "ssn", required: false },
    ],
    income: [
      { key: "hasW2", label: "Did you receive any W-2 forms?", type: "boolean", required: true },
      { key: "hasSelfEmployment", label: "Do you have self-employment income?", type: "boolean", required: true },
      { key: "hasInvestmentIncome", label: "Do you have investment income?", type: "boolean", required: true },
    ],
    deductions: [
      { key: "deductionType", label: "Standard or Itemized Deductions?", type: "select", required: true },
      { key: "mortgageInterest", label: "Mortgage Interest Paid", type: "currency", required: false },
      { key: "charitable", label: "Charitable Contributions", type: "currency", required: false },
    ],
  };

  return questions[section] ?? [];
}
