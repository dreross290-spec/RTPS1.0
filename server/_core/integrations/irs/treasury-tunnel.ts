/**
 * Treasury Tunnel
 *
 * Unified real-time coordinator that combines:
 *   1. IRS CADE2 transcript / refund status data
 *   2. Bureau of Fiscal Services (BFS) Treasury Offset Program (TOP) offsets
 *   3. BFS disbursement tracking
 *
 * Consumers subscribe via the `TreasuryTunnel` event emitter and receive a
 * single `TunnelUpdate` event whenever either upstream source reports a change.
 *
 * This module is used by:
 *   - The Server-Sent Events (SSE) streaming endpoint
 *     (`pages/api/refund-status/stream/[returnId].ts`)
 *   - The background refund-status worker
 *     (`server/workers/refund-status-poller.ts`)
 */

import { EventEmitter } from "events";
import { CADE2Client } from "./cade2-client.js";
import { BFSClient } from "../bfs/bfs-client.js";
import type { IRSRefundStatus } from "../../notifications/types.js";
import type { DisbursementRecord, TOPOffsetSummary } from "../bfs/bfs-client.js";
// ─── Types ────────────────────────────────────────────────────────────────────

export interface TunnelUpdate {
  /** Return identifier correlating this update to a specific tax return. */
  returnId: string;

  /** ISO 8601 timestamp when RTPS assembled this update. */
  fetchedAt: string;

  /** IRS CADE2 refund status (null when IRS request failed). */
  irsStatus: IRSRefundStatus | null;

  /** Treasury Offset Program summary (null when BFS not yet available). */
  topOffsets: TOPOffsetSummary | null;

  /** Treasury disbursement record (null when payment not yet issued). */
  disbursement: DisbursementRecord | null;

  /** Whether any data sources returned errors. */
  hasErrors: boolean;

  /** Non-fatal error messages from individual sources. */
  errors: string[];
}

export interface TunnelPollOptions {
  /** EIN / SSN of the taxpayer. */
  tin: string;
  /** 4-digit tax year. */
  taxYear: number;
  /** Treasury payment ID (obtained from IRS transcript after refund is sent). */
  treasuryPaymentId?: string;
}

// ─── Event map (typed emitter) ────────────────────────────────────────────────

interface TreasuryTunnelEvents {
  update: (payload: TunnelUpdate) => void;
  error: (err: Error) => void;
}

// ─── Tunnel ───────────────────────────────────────────────────────────────────

/**
 * `TreasuryTunnel` — EventEmitter that polls IRS and BFS in parallel and
 * emits a unified `TunnelUpdate` for every poll cycle.
 *
 * ```ts
 * const tunnel = new TreasuryTunnel(cade2Client, bfsClient);
 * tunnel.on("update", (u) => sseStream.send(u));
 * await tunnel.poll(returnId, { tin, taxYear });
 * ```
 */
export class TreasuryTunnel extends EventEmitter {
  private readonly cade2: CADE2Client;
  private readonly bfs: BFSClient;

  constructor(cade2: CADE2Client, bfs: BFSClient) {
    super();
    this.cade2 = cade2;
    this.bfs = bfs;
  }

  on(event: "update", listener: (payload: TunnelUpdate) => void): this;
  on(event: "error",  listener: (err: Error) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  emit(event: "update", payload: TunnelUpdate): boolean;
  emit(event: "error",  err: Error): boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Performs a single parallel poll of IRS + BFS and emits a `TunnelUpdate`.
   * Never throws — errors are captured inside the update payload.
   */
  async poll(returnId: string, opts: TunnelPollOptions): Promise<TunnelUpdate> {
    const fetchedAt = new Date().toISOString();
    const errors: string[] = [];

    // ── Run all upstream calls in parallel ────────────────────────────────────
    const [irsResult, topResult, disbResult] = await Promise.allSettled([
      this.cade2.getRefundStatus(opts.tin, opts.taxYear),
      this.bfs.getTopOffsets(opts.tin, opts.taxYear),
      opts.treasuryPaymentId
        ? this.bfs.getDisbursementStatus(opts.treasuryPaymentId)
        : Promise.resolve(null),
    ]);

    // ── IRS ───────────────────────────────────────────────────────────────────
    let irsStatus: IRSRefundStatus | null = null;
    if (irsResult.status === "fulfilled") {
      irsStatus = irsResult.value;
    } else {
      const msg = irsResult.reason instanceof Error ? irsResult.reason.message : String(irsResult.reason);
      errors.push(`IRS CADE2: ${msg}`);
      this.log("warn", returnId, `IRS poll error: ${msg}`);
    }

    // ── BFS TOP offsets ───────────────────────────────────────────────────────
    let topOffsets: TOPOffsetSummary | null = null;
    if (topResult.status === "fulfilled") {
      topOffsets = topResult.value;
    } else {
      const msg = topResult.reason instanceof Error ? topResult.reason.message : String(topResult.reason);
      // 404 = no offsets found yet; not an error worth surfacing
      if (!msg.includes("No BFS record")) {
        errors.push(`BFS TOP: ${msg}`);
        this.log("warn", returnId, `BFS TOP error: ${msg}`);
      }
    }

    // ── BFS Disbursement ──────────────────────────────────────────────────────
    let disbursement: DisbursementRecord | null = null;
    if (disbResult.status === "fulfilled") {
      disbursement = disbResult.value;
    } else {
      const msg = disbResult.reason instanceof Error ? disbResult.reason.message : String(disbResult.reason);
      errors.push(`BFS Disbursement: ${msg}`);
      this.log("warn", returnId, `BFS disbursement error: ${msg}`);
    }

    // ── Assemble update ───────────────────────────────────────────────────────
    const update: TunnelUpdate = {
      returnId,
      fetchedAt,
      irsStatus,
      topOffsets,
      disbursement,
      hasErrors: errors.length > 0,
      errors,
    };

    this.emit("update", update);
    this.log(
      "info",
      returnId,
      `Poll complete — IRS=${irsStatus?.irsStatus ?? "n/a"}, offsets=${topOffsets?.offsets.length ?? 0}, disbursement=${disbursement?.status ?? "n/a"}`,
    );

    return update;
  }

  private log(level: "info" | "warn", returnId: string, message: string): void {
    const entry = { level, service: "TreasuryTunnel", returnId, message, ts: new Date().toISOString() };
    if (level === "warn") console.warn(JSON.stringify(entry));
    else console.log(JSON.stringify(entry));
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _tunnel: TreasuryTunnel | null = null;

/**
 * Returns a lazily-initialised singleton `TreasuryTunnel` configured from
 * environment variables.  Safe to call multiple times.
 */
export function getTreasuryTunnel(): TreasuryTunnel {
  if (_tunnel === null) {
    const cade2 = new CADE2Client(
      process.env["IRS_CADE2_SERVICE_URL"] ?? "",
      process.env["IRS_CADE2_API_KEY"] ?? "",
    );
    const bfs = new BFSClient(
      process.env["BFS_API_BASE_URL"] ?? "",
      process.env["BFS_API_KEY"] ?? "",
      process.env["BFS_CLIENT_ID"] ?? "",
      process.env["BFS_CLIENT_SECRET"] ?? "",
    );
    _tunnel = new TreasuryTunnel(cade2, bfs);
  }
  return _tunnel;
}
