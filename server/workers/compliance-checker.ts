import { db } from "@server/lib/db";
import { preparers, auditLogs } from "@/drizzle/schema";
import { eq, lt, and } from "drizzle-orm";
import { addDays } from "date-fns";

/**
 * Run all daily compliance checks.
 */
export async function runDailyComplianceChecks(): Promise<void> {
  console.log("[ComplianceChecker] Running daily compliance checks...");

  await checkPreparerCertifications();
  await flagComplianceIssues();

  console.log("[ComplianceChecker] Daily checks complete.");
}

/**
 * Check all preparer certifications for expiration.
 * Flags preparers whose certs expire within 30 days.
 */
export async function checkPreparerCertifications(): Promise<void> {
  const warningDate = addDays(new Date(), 30);

  const expiringPreparers = await db
    .select()
    .from(preparers)
    .where(
      and(
        eq(preparers.active, true),
        lt(preparers.certExpiryDate, warningDate)
      )
    );

  for (const preparer of expiringPreparers) {
    const daysUntilExpiry = preparer.certExpiryDate
      ? Math.ceil((preparer.certExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    console.warn(
      `[ComplianceChecker] Preparer ${preparer.preparerId} cert expires in ${daysUntilExpiry} days`
    );

    // Log compliance issue to audit log
    await db.insert(auditLogs).values({
      accountId: preparer.accountId,
      userId: "system",
      action: "compliance_warning",
      entityType: "preparer",
      entityId: preparer.preparerId,
      changes: {
        issue: "cert_expiring",
        daysUntilExpiry,
        certExpiryDate: preparer.certExpiryDate?.toISOString(),
      },
    });
  }

  console.log(`[ComplianceChecker] Found ${expiringPreparers.length} preparers with expiring certifications.`);
}

/**
 * Identify and flag general compliance issues across the system.
 */
export async function flagComplianceIssues(): Promise<void> {
  // Check for preparers without PTINs (required by IRS)
  const noPTIN = await db
    .select()
    .from(preparers)
    .where(and(eq(preparers.active, true), eq(preparers.ptin, "")));

  for (const preparer of noPTIN) {
    await db.insert(auditLogs).values({
      accountId: preparer.accountId,
      userId: "system",
      action: "compliance_violation",
      entityType: "preparer",
      entityId: preparer.preparerId,
      changes: { issue: "missing_ptin", severity: "critical" },
    });
  }

  if (noPTIN.length > 0) {
    console.error(`[ComplianceChecker] ${noPTIN.length} active preparers are missing PTINs!`);
  }
}
