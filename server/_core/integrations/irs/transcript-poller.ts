/**
 * IRS Transcript Poller
 *
 * Manages scheduled cron jobs that poll the IRS CADE-2 API for transcript
 * updates.  "Hot" returns (filed within 48h) are polled hourly; all other
 * active returns are polled daily.  Emits events when status changes are
 * detected so downstream handlers can trigger notifications.
 */

import { EventEmitter } from "node:events";
import * as cron from "node-cron";
import { CADE2Client } from "./cade2-client.js";
import { mapTranscriptToRefundStatus } from "./status-mapper.js";
import type { IRSTranscript, PollingConfig, PollingStatus } from "../../notifications/types.js";

// ─── Events ───────────────────────────────────────────────────────────────────

export interface TranscriptPollerEvents {
  statusChange: [returnId: string, transcript: IRSTranscript];
  pollError: [returnId: string, error: Error];
  pollComplete: [returnId: string, changed: boolean];
}

// ─── Return Registry ──────────────────────────────────────────────────────────

interface RegisteredReturn {
  returnId: string;
  ein: string;
  taxYear: number;
  filedAt: Date;
  lastPollTime: Date | null;
  consecutiveFailures: number;
  lastKnownStatus: string | null;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: PollingConfig = {
  hotReturnCronExpression: "0 * * * *",    // every hour
  routineCronExpression: "0 9 * * *",      // daily at 09:00 UTC
  hotReturnThresholdHours: 48,
  maxConsecutiveFailures: 5,
  requestTimeoutMs: 30_000,
};

// ─── TranscriptPoller ────────────────────────────────────────────────────────

export class TranscriptPoller extends EventEmitter {
  private readonly client: CADE2Client;
  private readonly config: PollingConfig;

  private hotJob: ReturnType<typeof cron.schedule> | null = null;
  private routineJob: ReturnType<typeof cron.schedule> | null = null;
  private running = false;

  /** Registry of all returns being tracked. */
  private readonly returns = new Map<string, RegisteredReturn>();

  private lastHotPollTime: Date | null = null;
  private lastRoutinePollTime: Date | null = null;
  private totalPollCount = 0;

  constructor(client: CADE2Client, config: Partial<PollingConfig> = {}) {
    super();
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Register a return to be monitored by the poller.
   */
  registerReturn(returnId: string, ein: string, taxYear: number, filedAt: Date): void {
    if (!this.returns.has(returnId)) {
      this.returns.set(returnId, {
        returnId,
        ein,
        taxYear,
        filedAt,
        lastPollTime: null,
        consecutiveFailures: 0,
        lastKnownStatus: null,
      });
      this.log("info", `Registered return ${returnId} for polling`);
    }
  }

  /**
   * Deregister a return (e.g., when refund is fully deposited).
   */
  deregisterReturn(returnId: string): void {
    this.returns.delete(returnId);
    this.log("info", `Deregistered return ${returnId}`);
  }

  /**
   * Start the cron-based polling schedules.
   */
  startPolling(): void {
    if (this.running) {
      this.log("warn", "Poller already running");
      return;
    }

    if (!cron.validate(this.config.hotReturnCronExpression)) {
      throw new Error(`Invalid hot return cron expression: ${this.config.hotReturnCronExpression}`);
    }
    if (!cron.validate(this.config.routineCronExpression)) {
      throw new Error(`Invalid routine cron expression: ${this.config.routineCronExpression}`);
    }

    this.hotJob = cron.schedule(this.config.hotReturnCronExpression, () => {
      void this.runHotPoll();
    });

    this.routineJob = cron.schedule(this.config.routineCronExpression, () => {
      void this.runRoutinePoll();
    });

    this.running = true;
    this.log("info", "Polling started");
  }

  /**
   * Stop all cron jobs and mark the poller as stopped.
   */
  stopPolling(): void {
    this.hotJob?.stop();
    this.routineJob?.stop();
    this.hotJob = null;
    this.routineJob = null;
    this.running = false;
    this.log("info", "Polling stopped");
  }

  /**
   * Force an immediate poll for a specific return regardless of schedule.
   */
  async pollReturnNow(returnId: string): Promise<void> {
    const entry = this.returns.get(returnId);
    if (!entry) {
      throw new Error(`Return ${returnId} is not registered for polling`);
    }
    await this.pollReturn(entry);
  }

  /**
   * Returns the current state of the poller.
   */
  getPollingStatus(): PollingStatus {
    const failures = new Map<string, number>();
    for (const [id, entry] of this.returns) {
      if (entry.consecutiveFailures > 0) {
        failures.set(id, entry.consecutiveFailures);
      }
    }

    return {
      isRunning: this.running,
      lastHotPollTime: this.lastHotPollTime,
      lastRoutinePollTime: this.lastRoutinePollTime,
      activeJobCount: this.returns.size,
      consecutiveFailures: failures,
      totalPollCount: this.totalPollCount,
    };
  }

  // ─── Private Polling Logic ──────────────────────────────────────────────────

  private async runHotPoll(): Promise<void> {
    this.lastHotPollTime = new Date();
    const hotReturns = this.getHotReturns();
    this.log("info", `Hot poll: ${hotReturns.length} returns`);

    await Promise.allSettled(hotReturns.map((r) => this.pollReturn(r)));
  }

  private async runRoutinePoll(): Promise<void> {
    this.lastRoutinePollTime = new Date();
    const routineReturns = this.getRoutineReturns();
    this.log("info", `Routine poll: ${routineReturns.length} returns`);

    // Poll routine returns sequentially to avoid overwhelming the IRS API
    for (const entry of routineReturns) {
      await this.pollReturn(entry);
    }
  }

  private getHotReturns(): RegisteredReturn[] {
    const cutoff = Date.now() - this.config.hotReturnThresholdHours * 60 * 60 * 1000;
    return Array.from(this.returns.values()).filter(
      (r) => r.filedAt.getTime() >= cutoff && r.consecutiveFailures < this.config.maxConsecutiveFailures,
    );
  }

  private getRoutineReturns(): RegisteredReturn[] {
    const cutoff = Date.now() - this.config.hotReturnThresholdHours * 60 * 60 * 1000;
    return Array.from(this.returns.values()).filter(
      (r) => r.filedAt.getTime() < cutoff && r.consecutiveFailures < this.config.maxConsecutiveFailures,
    );
  }

  private async pollReturn(entry: RegisteredReturn): Promise<void> {
    const { returnId, ein, taxYear } = entry;
    this.totalPollCount++;

    try {
      const transcript = await this.client.getTranscript(ein, taxYear);
      const statusUpdate = mapTranscriptToRefundStatus(transcript);
      const newStatus = statusUpdate.newStatus;

      entry.lastPollTime = new Date();
      entry.consecutiveFailures = 0;

      const statusChanged = newStatus !== entry.lastKnownStatus;
      if (statusChanged) {
        this.log("info", `Status change detected for ${returnId}: ${entry.lastKnownStatus} → ${newStatus}`);
        entry.lastKnownStatus = newStatus;
        this.emit("statusChange", returnId, transcript);
      }

      this.emit("pollComplete", returnId, statusChanged);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      entry.consecutiveFailures++;
      entry.lastPollTime = new Date();

      this.log("error", `Poll failed for ${returnId} (failures: ${entry.consecutiveFailures}): ${error.message}`);
      this.emit("pollError", returnId, error);

      if (entry.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        this.log("warn", `Return ${returnId} has reached max consecutive failures (${this.config.maxConsecutiveFailures}). De-prioritizing.`);
      }
    }
  }

  private log(level: "info" | "warn" | "error", message: string): void {
    const entry = {
      level,
      service: "TranscriptPoller",
      message,
      activeReturns: this.returns.size,
      ts: new Date().toISOString(),
    };
    if (level === "error") {
      console.error(JSON.stringify(entry));
    } else if (level === "warn") {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }
}
