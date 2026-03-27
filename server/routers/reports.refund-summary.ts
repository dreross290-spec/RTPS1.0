/**
 * Refund Summary PDF tRPC Router
 *
 * Exposes procedures for generating and downloading individual PDF refund
 * status summary reports for Ross Tax Pro Software clients.
 *
 * Procedures:
 *   reports.refundSummary.generate  — generate and return base64-encoded PDF
 *   reports.refundSummary.metadata  — return report metadata without generating PDF
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import {
  refundStatusHistory,
  clients,
  taxReturns,
} from "../../drizzle/schema/index.js";
import {
  generateRefundSummaryPdf,
  type RefundHistoryEntry,
  type RefundSummaryPdfData,
} from "../_core/reports/refund-summary-pdf.js";
import { checkTopOffsets } from "../_core/integrations/bfs/top-offset-checker.js";
import { BFSClient } from "../_core/integrations/bfs/bfs-client.js";
import { decrypt } from "../lib/utils/encryption.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBFSClient(): BFSClient {
  return new BFSClient(
    process.env["BFS_API_BASE_URL"] ?? "",
    process.env["BFS_API_KEY"] ?? "",
    process.env["BFS_CLIENT_ID"] ?? "",
    process.env["BFS_CLIENT_SECRET"] ?? "",
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const refundSummaryRouter = router({
  /**
   * Generates a branded PDF refund status summary for the given return.
   * Returns the PDF as a base64-encoded string so it can be transferred via
   * JSON and decoded by the client into a Blob / download link.
   */
  generate: protectedProcedure
    .input(
      z.object({
        returnId: z.string().uuid(),
        /** Include BFS TOP offset check.  Defaults to true. */
        includeTopOffsets: z.boolean().default(true),
        /** Treasury payment tracking ID for disbursement status. */
        treasuryPaymentId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ── 1. Load tax return ──────────────────────────────────────────────
      const returnRows = await ctx.db
        .select()
        .from(taxReturns)
        .where(eq(taxReturns.returnId, input.returnId))
        .limit(1);

      const taxReturn = returnRows[0];
      if (!taxReturn) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tax return not found" });
      }

      // ── 2. Load client ──────────────────────────────────────────────────
      const clientRows = await ctx.db
        .select()
        .from(clients)
        .where(eq(clients.clientId, taxReturn.clientId))
        .limit(1);

      const client = clientRows[0];
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      // ── 3. Load refund status history (keyed by returnId) ────────────────
      const historyRows = await ctx.db
        .select()
        .from(refundStatusHistory)
        .where(eq(refundStatusHistory.returnId, input.returnId))
        .orderBy(desc(refundStatusHistory.createdAt))
        .limit(20);

      const latestStatus = historyRows[0];

      // ── 4. Optional BFS TOP offset check ───────────────────────────────
      let topOffsets: RefundSummaryPdfData["topOffsets"] = [];
      let totalOffsetCents = 0;
      let netRefundCents: number | undefined;

      if (input.includeTopOffsets && process.env["BFS_API_KEY"]) {
        try {
          const tin = decrypt(client.ssnEncrypted);
          const result = await checkTopOffsets(tin, taxReturn.taxYear);
          topOffsets = result.offsets.map((o) => ({
            creditorAgency: o.creditorAgency,
            debtDescription: o.debtDescription,
            offsetAmountCents: o.offsetAmountCents,
          }));
          totalOffsetCents = result.totalOffsetCents;
          netRefundCents = result.netRefundCents;
        } catch (err) {
          console.warn(JSON.stringify({
            level: "warn", service: "RefundSummaryPdf",
            message: "BFS TOP offset check failed (non-fatal); continuing without offset data",
            returnId: input.returnId,
            error: err instanceof Error ? err.message : String(err),
            ts: new Date().toISOString(),
          }));
        }
      }

      // ── 5. Optional BFS disbursement status ─────────────────────────────
      let disbursementStatus: string | null = null;
      let settlementDate: string | null = null;

      if (input.treasuryPaymentId && process.env["BFS_API_KEY"]) {
        try {
          const bfs = getBFSClient();
          const disb = await bfs.getDisbursementStatus(input.treasuryPaymentId);
          disbursementStatus = disb.status;
          settlementDate = disb.settlementDate;
        } catch (err) {
          console.warn(JSON.stringify({
            level: "warn", service: "RefundSummaryPdf",
            message: "BFS disbursement status check failed (non-fatal)",
            returnId: input.returnId,
            paymentId: input.treasuryPaymentId,
            error: err instanceof Error ? err.message : String(err),
            ts: new Date().toISOString(),
          }));
        }
      }

      // ── 6. Assemble PDF data ────────────────────────────────────────────
      // Use column names from drizzle/schema/notifications.ts (the exported schema)
      const history: RefundHistoryEntry[] = historyRows.map((r) => ({
        status: r.newStatus,
        recordedAt: r.createdAt,
        refundAmount: r.refundAmount,
        statusMessage: null,
      }));

      const pdfData: RefundSummaryPdfData = {
        clientFirstName: client.firstName,
        clientLastName:  client.lastName,
        taxYear:         String(taxReturn.taxYear),
        filingStatus:    taxReturn.filingStatus ?? client.filingStatus,
        trackingNumber:  taxReturn.ackNumber,

        currentStatus:       latestStatus?.newStatus ?? taxReturn.refundStatus ?? "return_received",
        refundAmount:        latestStatus?.refundAmount ?? taxReturn.refundAmount,
        expectedDepositDate: null,
        statusMessage:       null,
        paymentMethod:       null,

        topOffsets,
        totalOffsetCents,
        netRefundCents,

        disbursementStatus,
        settlementDate,

        history,
        generatedAt: new Date(),
      };

      // ── 7. Generate PDF ─────────────────────────────────────────────────
      const pdfBytes = await generateRefundSummaryPdf(pdfData);

      return {
        filename: `refund-summary-${taxReturn.taxYear}-${client.lastName}.pdf`,
        contentType: "application/pdf",
        /** Base64-encoded PDF. Decode on client: Buffer.from(data, "base64") */
        data: Buffer.from(pdfBytes).toString("base64"),
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Returns report metadata for the given return (no PDF generated).
   * Useful for showing a preview panel before triggering the download.
   */
  metadata: protectedProcedure
    .input(z.object({ returnId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const returnRows = await ctx.db
        .select()
        .from(taxReturns)
        .where(eq(taxReturns.returnId, input.returnId))
        .limit(1);

      const taxReturn = returnRows[0];
      if (!taxReturn) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tax return not found" });
      }

      const clientRows = await ctx.db
        .select()
        .from(clients)
        .where(eq(clients.clientId, taxReturn.clientId))
        .limit(1);

      const client = clientRows[0];
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const latestRows = await ctx.db
        .select()
        .from(refundStatusHistory)
        .where(eq(refundStatusHistory.returnId, input.returnId))
        .orderBy(desc(refundStatusHistory.createdAt))
        .limit(1);

      const latest = latestRows[0];

      return {
        returnId:       input.returnId,
        clientName:     `${client.firstName} ${client.lastName}`,
        taxYear:        String(taxReturn.taxYear),
        currentStatus:  latest?.newStatus ?? taxReturn.refundStatus ?? "return_received",
        refundAmount:   latest?.refundAmount ?? taxReturn.refundAmount ?? null,
        trackingNumber: taxReturn.ackNumber ?? null,
        lastUpdated:    latest?.createdAt ?? taxReturn.updatedAt,
      };
    }),
});
