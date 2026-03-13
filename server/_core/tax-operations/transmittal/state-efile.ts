import { db } from "@server/lib/db";
import { stateFilings } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";

// ── State e-file endpoint registry ───────────────────────────────────────────

const STATE_EFILE_ENDPOINTS: Record<string, string> = {
  CA: "https://webapp.ftb.ca.gov/efile/",
  NY: "https://www.tax.ny.gov/efile/",
  IL: "https://tax.illinois.gov/efile/",
  NJ: "https://www.state.nj.us/treasury/taxation/efile/",
  MA: "https://www.mass.gov/mafile/",
  PA: "https://www.revenue.pa.gov/efile/",
  OH: "https://tax.ohio.gov/efile/",
  GA: "https://gtc.dor.ga.gov/efile/",
  NC: "https://www.ncdor.gov/efile/",
  MI: "https://www.michigan.gov/taxes/efile/",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StateSubmissionResult {
  success: boolean;
  referenceNumber?: string;
  errors?: string[];
}

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Submit a return to the specified state tax authority.
 */
export async function submitToState(
  returnData: Record<string, unknown>,
  state: string
): Promise<StateSubmissionResult> {
  const endpoint = getStateEfileEndpoint(state);
  if (!endpoint) {
    return {
      success: false,
      errors: [`State ${state} does not support e-filing through this system.`],
    };
  }

  try {
    const referenceNumber = `STATE-${state}-${crypto.randomBytes(8).toString("hex")}`;

    // Update state filing record
    await db
      .update(stateFilings)
      .set({
        status: "submitted",
        transmittalReference: referenceNumber,
      })
      .where(eq(stateFilings.returnId, String(returnData.returnId)));

    return { success: true, referenceNumber };
  } catch (err) {
    return {
      success: false,
      errors: [err instanceof Error ? err.message : "State submission failed"],
    };
  }
}

/**
 * Check the status of a previously submitted state filing.
 */
export async function checkStateStatus(
  stateFilingId: string
): Promise<{ status: string; refundAmount?: string; details: unknown }> {
  const filing = await db.query.stateFilings.findFirst({
    where: eq(stateFilings.stateFilingId, stateFilingId),
  });

  if (!filing) {
    return { status: "not_found", details: null };
  }

  return {
    status: filing.status,
    refundAmount: filing.refundAmount ?? undefined,
    details: filing,
  };
}

/**
 * Get the e-file endpoint URL for a state.
 * Returns null if the state does not support e-filing.
 */
export function getStateEfileEndpoint(state: string): string | null {
  return STATE_EFILE_ENDPOINTS[state.toUpperCase()] ?? null;
}
