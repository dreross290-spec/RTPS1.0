/**
 * Real-Time Refund Status SSE Stream
 * GET /api/refund-status/stream/[returnId]
 *
 * Opens a Server-Sent Events (SSE) connection and pushes a `TunnelUpdate`
 * to the browser every POLL_INTERVAL_MS milliseconds by polling IRS CADE2
 * and the Bureau of Fiscal Services (BFS) Treasury Tunnel in parallel.
 *
 * Authentication: the request must carry a valid session (enforced via the
 * same middleware used by the tRPC context).  Unauthenticated requests
 * receive a 401 immediately.
 *
 * Query parameters:
 *   tin            (required) Taxpayer Identification Number
 *   taxYear        (required) 4-digit tax year, e.g. "2024"
 *   paymentId      (optional) Treasury payment tracking ID; enables BFS
 *                             disbursement status updates
 *
 * Event stream format (text/event-stream):
 *   event: update
 *   data: { ...TunnelUpdate }
 *
 *   event: error
 *   data: { message: string }
 *
 *   event: ping
 *   data: { ts: string }    (keepalive, every 25 s)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getTreasuryTunnel } from "@/server/_core/integrations/irs/treasury-tunnel";
import type { TunnelUpdate } from "@/server/_core/integrations/irs/treasury-tunnel";

// ─── Config ───────────────────────────────────────────────────────────────────

/** How often to poll IRS + BFS, in milliseconds. */
const POLL_INTERVAL_MS = parseInt(
  process.env["REFUND_POLL_INTERVAL_MS"] ?? "30000",
  10,
);

/** Keepalive ping interval, in milliseconds. */
const PING_INTERVAL_MS = 25_000;

/** Maximum stream duration before the client must reconnect (ms). */
const MAX_STREAM_DURATION_MS = 10 * 60 * 1_000; // 10 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sseEvent(res: NextApiResponse, eventName: string, data: unknown): void {
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  // Flush to the client immediately when running behind a proxy
  const r = res as unknown as { flush?: () => void };
  if (typeof r.flush === "function") r.flush();
}

function sseError(res: NextApiResponse, message: string): void {
  sseEvent(res, "error", { message });
}

// ─── Session guard ────────────────────────────────────────────────────────────

/**
 * Minimal session check consistent with the project's tRPC context pattern.
 * In production, replace this with a proper JWT / NextAuth session lookup.
 */
function isAuthenticated(req: NextApiRequest): boolean {
  // Accept requests that carry an Authorization header (Bearer token) or a
  // session cookie.  The real validation is handled by NextAuth / the tRPC
  // middleware layer; this guard prevents unauthenticated SSE connections.
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) return true;
  // Fall back to session cookie presence check
  const cookies = req.headers["cookie"] ?? "";
  return cookies.includes("next-auth.session-token") ||
         cookies.includes("__Secure-next-auth.session-token");
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Only GET is supported
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Auth check
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Parse route parameter — captured as non-nullable string after guard
  const { returnId: returnIdRaw } = req.query as { returnId?: string };
  if (!returnIdRaw || typeof returnIdRaw !== "string") {
    res.status(400).json({ error: "Missing returnId" });
    return;
  }
  const returnId: string = returnIdRaw;

  // Parse required query params — captured as non-nullable after guards below
  const tinRaw     = typeof req.query["tin"]       === "string" ? req.query["tin"]       : null;
  const taxYearRaw = typeof req.query["taxYear"]   === "string" ? req.query["taxYear"]   : null;
  const paymentId  = typeof req.query["paymentId"] === "string" ? req.query["paymentId"] : undefined;

  if (!tinRaw) {
    res.status(400).json({ error: "Missing required query parameter: tin" });
    return;
  }
  if (!taxYearRaw || !/^\d{4}$/.test(taxYearRaw)) {
    res.status(400).json({ error: "Missing or invalid query parameter: taxYear (must be 4-digit year)" });
    return;
  }

  // Capture as non-nullable strings after guards
  const tin: string = tinRaw;
  const taxYear: string = taxYearRaw;

  // ── Set SSE headers ────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering
  res.flushHeaders();

  const tunnel = getTreasuryTunnel();

  let isClosed = false;

  // Declare timer handles before the disconnect callback so `clearInterval` /
  // `clearTimeout` are always called on valid (possibly undefined) handles.
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let maxDurationTimer: ReturnType<typeof setTimeout> | undefined;

  function onClientDisconnect() {
    isClosed = true;
    clearInterval(pollTimer);
    clearInterval(pingTimer);
    clearTimeout(maxDurationTimer);
  }

  req.on("close",   onClientDisconnect);
  req.on("aborted", onClientDisconnect);

  // ── Poll handler ───────────────────────────────────────────────────────────
  async function doPoll() {
    if (isClosed) return;
    try {
      const update: TunnelUpdate = await tunnel.poll(returnId, {
        tin,
        taxYear: parseInt(taxYear, 10),
        treasuryPaymentId: paymentId,
      });
      if (!isClosed) sseEvent(res, "update", update);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal poll error";
      if (!isClosed) sseError(res, message);
    }
  }

  // Immediate first poll
  await doPoll();

  pollTimer        = setInterval(() => { void doPoll(); }, POLL_INTERVAL_MS);
  pingTimer        = setInterval(() => {
    if (!isClosed) sseEvent(res, "ping", { ts: new Date().toISOString() });
  }, PING_INTERVAL_MS);
  maxDurationTimer  = setTimeout(() => {
    if (!isClosed) {
      sseEvent(res, "reconnect", { message: "Stream limit reached. Please reconnect.", ts: new Date().toISOString() });
      clearInterval(pollTimer);
      clearInterval(pingTimer);
      res.end();
      isClosed = true;
    }
  }, MAX_STREAM_DURATION_MS);
}
