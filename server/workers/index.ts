import { pollAllActiveReturns } from "./refund-notification";
import { processCalculationQueue } from "./tax-calculator";
import { processTransmittalQueue, retryFailedTransmittals } from "./transmittal-processor";
import { pollForACKs } from "./ack-monitor";
import { runDailyComplianceChecks } from "./compliance-checker";

const REFUND_POLL_INTERVAL_MS =
  parseInt(process.env.REFUND_POLL_INTERVAL_MINUTES ?? "60") * 60 * 1000;

const NOTIFICATION_ENABLED =
  process.env.NOTIFICATION_WORKER_ENABLED !== "false";

// ── Worker Scheduler ──────────────────────────────────────────────────────────

function schedule(label: string, fn: () => Promise<void>, intervalMs: number): void {
  const run = async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[Worker:${label}] Unhandled error:`, err);
    } finally {
      setTimeout(run, intervalMs);
    }
  };

  // Stagger startup to avoid thundering herd
  const jitter = Math.floor(Math.random() * 5000);
  setTimeout(run, jitter);
  console.log(`[Workers] Scheduled ${label} every ${intervalMs / 1000}s`);
}

export function startAllWorkers(): void {
  console.log("[Workers] Starting all background workers...");

  // Refund notification worker — every N minutes (configurable)
  if (NOTIFICATION_ENABLED) {
    schedule("RefundNotification", pollAllActiveReturns, REFUND_POLL_INTERVAL_MS);
  } else {
    console.log("[Workers] RefundNotification worker is disabled via env config.");
  }

  // Tax calculation worker — every 2 minutes
  schedule("TaxCalculation", processCalculationQueue, 2 * 60 * 1000);

  // Transmittal processor — every 5 minutes
  schedule("TransmittalQueue", processTransmittalQueue, 5 * 60 * 1000);

  // Failed transmittal retries — every 30 minutes
  schedule("TransmittalRetry", retryFailedTransmittals, 30 * 60 * 1000);

  // IRS ACK monitor — every 15 minutes
  schedule("ACKMonitor", pollForACKs, 15 * 60 * 1000);

  // Compliance checks — once daily
  schedule("ComplianceChecker", runDailyComplianceChecks, 24 * 60 * 60 * 1000);

  console.log("[Workers] All workers started.");
}

// ── Entry Point ───────────────────────────────────────────────────────────────
// When run directly: `ts-node server/workers/index.ts`
if (require.main === module) {
  startAllWorkers();
  // Keep process alive
  process.on("SIGTERM", () => {
    console.log("[Workers] Received SIGTERM — shutting down gracefully.");
    process.exit(0);
  });
}
