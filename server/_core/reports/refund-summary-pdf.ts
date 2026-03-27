/**
 * Refund Summary PDF Generator
 *
 * Produces an individual, branded PDF report for a single taxpayer's refund
 * status, including:
 *   - Ross Tax Pro Software header with RT shield branding (navy / gold)
 *   - Taxpayer identification block (name, filing status, tax year)
 *   - Current IRS refund status with colour-coded badge
 *   - Treasury Offset Program (TOP) debt-offset table (if any)
 *   - BFS disbursement details (payment method, settlement date)
 *   - Status history timeline
 *   - Founder signature block and footer
 *
 * Dependencies: pdf-lib (pure JS — no browser required)
 *
 * Usage:
 * ```ts
 * const bytes = await generateRefundSummaryPdf(data);
 * res.setHeader("Content-Type", "application/pdf");
 * res.send(Buffer.from(bytes));
 * ```
 */

import {
  PDFDocument,
  PDFPage,
  rgb,
  StandardFonts,
  type RGB,
  type PDFFont,
} from "pdf-lib";
import { BRAND, BRAND_COLORS } from "../../lib/constants/brand.js";

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface RefundHistoryEntry {
  status: string;
  recordedAt: Date | string;
  refundAmount?: string | null;
  statusMessage?: string | null;
}

export interface TopOffsetEntry {
  creditorAgency: string;
  debtDescription: string;
  offsetAmountCents: number;
}

export interface RefundSummaryPdfData {
  // ── Taxpayer ──────────────────────────────────────────────────────────────
  clientFirstName: string;
  clientLastName: string;
  taxYear: string | number;
  filingStatus?: string | null;
  trackingNumber?: string | null;

  // ── Current IRS status ────────────────────────────────────────────────────
  currentStatus: string;
  refundAmount?: string | null;
  expectedDepositDate?: string | null;
  statusMessage?: string | null;
  paymentMethod?: "direct_deposit" | "check" | null;

  // ── TOP offsets ───────────────────────────────────────────────────────────
  topOffsets?: TopOffsetEntry[];
  totalOffsetCents?: number;
  netRefundCents?: number;

  // ── BFS disbursement ──────────────────────────────────────────────────────
  disbursementStatus?: string | null;
  settlementDate?: string | null;

  // ── Status history (chronological, oldest first) ──────────────────────────
  history?: RefundHistoryEntry[];

  // ── Report metadata ───────────────────────────────────────────────────────
  generatedAt?: Date;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

const C_NAVY  = hexToRgb(BRAND_COLORS.navy);
const C_GOLD  = hexToRgb(BRAND_COLORS.gold);
const C_WHITE = rgb(1, 1, 1);
const C_DARK  = rgb(0.07, 0.07, 0.1);
const C_MUTED = rgb(0.45, 0.50, 0.58);
const C_BORDER = rgb(0.88, 0.91, 0.94);
const C_GREEN = hexToRgb(BRAND_COLORS.statusGreen);
const C_ORANGE = hexToRgb(BRAND_COLORS.statusOrange);
const C_RED   = hexToRgb(BRAND_COLORS.statusRed);

// ─── Layout constants ─────────────────────────────────────────────────────────

const PAGE_W = 612;   // US Letter width in PDF points
const PAGE_H = 792;   // US Letter height in PDF points
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─── Status badge colours ─────────────────────────────────────────────────────

function statusColor(status: string): RGB {
  const s = status.toLowerCase();
  if (s.includes("deposited") || s.includes("approved")) return C_GREEN;
  if (s.includes("sent") || s.includes("processing") || s.includes("received")) return C_NAVY;
  if (s.includes("review") || s.includes("info") || s.includes("offset") || s.includes("amended")) return C_ORANGE;
  if (s.includes("rejected") || s.includes("cancelled")) return C_RED;
  return C_MUTED;
}

function formatStatus(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function centsToDisplay(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

interface DrawContext {
  page: PDFPage;
  boldFont: PDFFont;
  regularFont: PDFFont;
  y: number;  // current vertical cursor (top-down, converted to PDF coords inside helpers)
}

function pdfY(ctx: DrawContext, y: number): number {
  return PAGE_H - y;
}

function drawText(
  ctx: DrawContext,
  text: string,
  x: number,
  y: number,
  size: number,
  color: RGB,
  font: PDFFont,
): void {
  ctx.page.drawText(text, {
    x,
    y: pdfY(ctx, y),
    size,
    font,
    color,
  });
}

function drawRect(
  ctx: DrawContext,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: RGB,
): void {
  ctx.page.drawRectangle({
    x,
    y: pdfY(ctx, y + h),
    width: w,
    height: h,
    color: fill,
  });
}

function drawLine(ctx: DrawContext, x1: number, y: number, x2: number, color: RGB): void {
  ctx.page.drawLine({
    start: { x: x1, y: pdfY(ctx, y) },
    end:   { x: x2, y: pdfY(ctx, y) },
    thickness: 0.5,
    color,
  });
}

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * Generates a branded Ross Tax Pro refund summary PDF.
 * Returns the raw PDF bytes as a `Uint8Array`.
 */
export async function generateRefundSummaryPdf(
  data: RefundSummaryPdfData,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  const boldFont    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const ctx: DrawContext = { page, boldFont, regularFont, y: 0 };

  const generatedAt = data.generatedAt ?? new Date();

  // ── 1. Header bar (navy) ─────────────────────────────────────────────────
  drawRect(ctx, 0, 0, PAGE_W, 90, C_NAVY);

  // RT shield placeholder (two vertical rects as pillars + text "RT")
  const shieldX = MARGIN;
  drawRect(ctx, shieldX,      8,  6, 56, C_GOLD);          // left pillar
  drawRect(ctx, shieldX + 44, 8,  6, 56, C_GOLD);          // right pillar
  drawRect(ctx, shieldX + 6,  14, 38, 44, hexToRgb(BRAND_COLORS.navyMid)); // shield body
  // Shield border
  ctx.page.drawRectangle({
    x: shieldX + 6, y: pdfY(ctx, 58), width: 38, height: 44,
    borderColor: C_GOLD, borderWidth: 1.5, color: hexToRgb(BRAND_COLORS.navyMid),
  });
  drawText(ctx, "RT", shieldX + 13, 48, 18, C_GOLD, boldFont);

  // Firm name
  drawText(ctx, BRAND.firmName,    MARGIN + 62, 26, 18, C_GOLD,  boldFont);
  drawText(ctx, BRAND.founderTitle, MARGIN + 62, 44, 9.5, hexToRgb(BRAND_COLORS.goldMuted), regularFont);
  drawText(ctx, BRAND.tagline,     MARGIN + 62, 57, 9,   hexToRgb(BRAND_COLORS.textMuted),   regularFont);

  // Report label (right-aligned)
  const reportLabel = "REFUND STATUS SUMMARY";
  const reportLabelW = boldFont.widthOfTextAtSize(reportLabel, 11);
  drawText(ctx, reportLabel, PAGE_W - MARGIN - reportLabelW, 30, 11, C_GOLD, boldFont);
  const genLabel = `Generated: ${formatDate(generatedAt)}`;
  const genLabelW = regularFont.widthOfTextAtSize(genLabel, 8);
  drawText(ctx, genLabel, PAGE_W - MARGIN - genLabelW, 46, 8, hexToRgb(BRAND_COLORS.textMuted), regularFont);

  // Gold accent line under header
  drawRect(ctx, 0, 90, PAGE_W, 3, C_GOLD);

  // ── 2. Taxpayer info block ────────────────────────────────────────────────
  ctx.y = 108;
  const clientName = `${data.clientFirstName} ${data.clientLastName}`;
  drawText(ctx, clientName, MARGIN, ctx.y, 16, C_DARK, boldFont);
  ctx.y += 20;

  const infoItems: [string, string][] = [
    ["Tax Year",        String(data.taxYear)],
    ["Filing Status",   data.filingStatus ? formatStatus(data.filingStatus) : "—"],
    ["Tracking #",      data.trackingNumber ?? "—"],
    ["Payment Method",  data.paymentMethod === "check" ? "Paper Check" : data.paymentMethod === "direct_deposit" ? "Direct Deposit" : "—"],
  ];

  let infoX = MARGIN;
  for (const [label, value] of infoItems) {
    drawText(ctx, label,  infoX, ctx.y,      8,  C_MUTED, regularFont);
    drawText(ctx, value,  infoX, ctx.y + 13, 10, C_DARK,  boldFont);
    infoX += 138;
  }
  ctx.y += 34;
  drawLine(ctx, MARGIN, ctx.y, PAGE_W - MARGIN, C_BORDER);
  ctx.y += 14;

  // ── 3. Current status card ────────────────────────────────────────────────
  sectionHeader(ctx, "CURRENT IRS STATUS", MARGIN, ctx.y, boldFont, regularFont);
  ctx.y += 20;

  const statusColor_ = statusColor(data.currentStatus);
  // Status badge
  const statusText = formatStatus(data.currentStatus);
  const badgeW = boldFont.widthOfTextAtSize(statusText, 11) + 20;
  drawRect(ctx, MARGIN, ctx.y, badgeW, 22, statusColor_);
  drawText(ctx, statusText, MARGIN + 10, ctx.y + 7, 11, C_WHITE, boldFont);

  const amountLabel = data.refundAmount ?? "—";
  drawText(ctx, "Refund Amount",   MARGIN + badgeW + 20, ctx.y + 2,  8,  C_MUTED,  regularFont);
  drawText(ctx, amountLabel,       MARGIN + badgeW + 20, ctx.y + 13, 13, C_DARK,   boldFont);

  if (data.expectedDepositDate) {
    const edLabel = data.expectedDepositDate;
    const edX = MARGIN + badgeW + 180;
    drawText(ctx, "Expected Deposit",  edX, ctx.y + 2,  8,  C_MUTED,  regularFont);
    drawText(ctx, edLabel,             edX, ctx.y + 13, 11, C_DARK,   boldFont);
  }
  ctx.y += 34;

  if (data.statusMessage) {
    const wrapped = wrapText(data.statusMessage, regularFont, 9, CONTENT_W);
    for (const line of wrapped) {
      drawText(ctx, line, MARGIN, ctx.y, 9, C_MUTED, regularFont);
      ctx.y += 13;
    }
  }

  ctx.y += 8;
  drawLine(ctx, MARGIN, ctx.y, PAGE_W - MARGIN, C_BORDER);
  ctx.y += 14;

  // ── 4. Treasury Offset Program section ───────────────────────────────────
  if (data.topOffsets && data.topOffsets.length > 0) {
    sectionHeader(ctx, "TREASURY OFFSET PROGRAM (TOP)", MARGIN, ctx.y, boldFont, regularFont);
    ctx.y += 18;

    // Table header
    drawRect(ctx, MARGIN, ctx.y, CONTENT_W, 18, hexToRgb(BRAND_COLORS.navy));
    const cols = [
      { label: "Creditor Agency", x: MARGIN + 6,   w: 160 },
      { label: "Description",     x: MARGIN + 166,  w: 220 },
      { label: "Offset Amount",   x: MARGIN + 386,  w: 100 },
    ];
    for (const col of cols) {
      drawText(ctx, col.label, col.x, ctx.y + 5, 8, C_GOLD, boldFont);
    }
    ctx.y += 18;

    for (const [i, offset] of data.topOffsets.entries()) {
      if (i % 2 === 0) {
        drawRect(ctx, MARGIN, ctx.y, CONTENT_W, 16, rgb(0.96, 0.97, 0.99));
      }
      drawText(ctx, offset.creditorAgency,                      cols[0]!.x, ctx.y + 4, 8, C_DARK, regularFont);
      drawText(ctx, truncate(offset.debtDescription, 38),       cols[1]!.x, ctx.y + 4, 8, C_DARK, regularFont);
      drawText(ctx, centsToDisplay(offset.offsetAmountCents),   cols[2]!.x, ctx.y + 4, 8, C_RED,  boldFont);
      ctx.y += 16;
    }

    ctx.y += 6;
    // Net refund summary
    if (data.netRefundCents !== undefined) {
      drawText(ctx, "Net Refund After Offsets:", MARGIN + 280, ctx.y, 9, C_DARK, boldFont);
      drawText(ctx, centsToDisplay(data.netRefundCents),       MARGIN + 430, ctx.y, 10, C_GREEN, boldFont);
      ctx.y += 18;
    }

    drawLine(ctx, MARGIN, ctx.y, PAGE_W - MARGIN, C_BORDER);
    ctx.y += 14;
  }

  // ── 5. BFS Disbursement ───────────────────────────────────────────────────
  if (data.disbursementStatus) {
    sectionHeader(ctx, "TREASURY DISBURSEMENT", MARGIN, ctx.y, boldFont, regularFont);
    ctx.y += 18;

    const disbItems: [string, string][] = [
      ["Disbursement Status", formatStatus(data.disbursementStatus)],
      ["Settlement Date",     formatDate(data.settlementDate)],
    ];
    let dx = MARGIN;
    for (const [label, value] of disbItems) {
      drawText(ctx, label,  dx, ctx.y,      8,  C_MUTED, regularFont);
      drawText(ctx, value,  dx, ctx.y + 13, 10, C_DARK,  boldFont);
      dx += 200;
    }
    ctx.y += 34;
    drawLine(ctx, MARGIN, ctx.y, PAGE_W - MARGIN, C_BORDER);
    ctx.y += 14;
  }

  // ── 6. Status History ─────────────────────────────────────────────────────
  if (data.history && data.history.length > 0) {
    sectionHeader(ctx, "STATUS HISTORY", MARGIN, ctx.y, boldFont, regularFont);
    ctx.y += 18;

    for (const entry of data.history.slice().reverse()) {
      const dot = "●";
      const entryColor = statusColor(entry.status);
      drawText(ctx, dot, MARGIN, ctx.y, 10, entryColor, boldFont);
      drawText(ctx, formatStatus(entry.status),       MARGIN + 14, ctx.y, 9, C_DARK, boldFont);
      drawText(ctx, formatDate(entry.recordedAt),     MARGIN + 180, ctx.y, 8, C_MUTED, regularFont);
      if (entry.refundAmount) {
        drawText(ctx, entry.refundAmount, MARGIN + 310, ctx.y, 8, C_DARK, regularFont);
      }
      ctx.y += 14;
      if (entry.statusMessage) {
        const msgLines = wrapText(entry.statusMessage, regularFont, 7.5, CONTENT_W - 24);
        for (const line of msgLines.slice(0, 2)) {
          drawText(ctx, line, MARGIN + 14, ctx.y, 7.5, C_MUTED, regularFont);
          ctx.y += 11;
        }
      }
    }

    ctx.y += 8;
    drawLine(ctx, MARGIN, ctx.y, PAGE_W - MARGIN, C_BORDER);
    ctx.y += 14;
  }

  // ── 7. Footer ────────────────────────────────────────────────────────────
  const footerTop = PAGE_H - 72;
  drawRect(ctx, 0, footerTop - 3, PAGE_W, 3, C_GOLD);
  drawRect(ctx, 0, footerTop,     PAGE_W, 72, C_NAVY);

  // Founder signature block
  drawText(ctx, BRAND.founderName,  MARGIN, footerTop + 16, 10, C_GOLD,  boldFont);
  drawText(ctx, BRAND.founderTitle, MARGIN, footerTop + 30, 8,  hexToRgb(BRAND_COLORS.goldMuted), regularFont);
  drawText(ctx, BRAND.tagline,      MARGIN, footerTop + 43, 7.5, hexToRgb(BRAND_COLORS.textMuted),  regularFont);

  // Disclaimer (right side)
  const disclaimer =
    "This report is for informational purposes only. Refund data sourced from the IRS CADE2 system\n" +
    "and the U.S. Treasury Bureau of Fiscal Services. Contact your preparer for guidance.";
  const disclaimerLines = disclaimer.split("\n");
  let dly = footerTop + 16;
  for (const line of disclaimerLines) {
    const lw = regularFont.widthOfTextAtSize(line, 6.5);
    drawText(ctx, line, PAGE_W - MARGIN - lw, dly, 6.5, hexToRgb(BRAND_COLORS.textMuted), regularFont);
    dly += 11;
  }

  // Website
  const site = BRAND.website;
  const siteW = regularFont.widthOfTextAtSize(site, 7);
  drawText(ctx, site, PAGE_W - MARGIN - siteW, footerTop + 50, 7, hexToRgb(BRAND_COLORS.goldMuted), regularFont);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

// ─── Internal utilities ───────────────────────────────────────────────────────

function sectionHeader(
  ctx: DrawContext,
  label: string,
  x: number,
  y: number,
  boldFont: PDFFont,
  regularFont: PDFFont,
): void {
  // Gold left accent bar
  ctx.page.drawRectangle({ x, y: pdfY(ctx, y + 12), width: 3, height: 12, color: C_GOLD });
  ctx.page.drawText(label, {
    x: x + 10, y: pdfY(ctx, y + 2), size: 9, font: boldFont, color: C_NAVY,
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
}
