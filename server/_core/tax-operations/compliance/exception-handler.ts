import { db } from "@server/lib/db";
import { v4 as uuidv4 } from "uuid";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExceptionType =
  | "due_diligence"
  | "validation_error"
  | "compliance_risk"
  | "identity_verification"
  | "unusual_credit"
  | "refund_discrepancy"
  | "preparer_certification";

export interface TaxException {
  exceptionId: string;
  returnId: string;
  accountId: string;
  type: ExceptionType;
  details: Record<string, unknown>;
  status: "open" | "resolved" | "escalated";
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface ExceptionResolution {
  notes: string;
  resolvedBy: string;
  escalate?: boolean;
}

// In-memory exception store — replace with database table in production
const exceptionStore = new Map<string, TaxException>();

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Flag an exception on a return.
 */
export async function flagException(
  returnId: string,
  accountId: string,
  type: ExceptionType,
  details: Record<string, unknown>
): Promise<TaxException> {
  const exception: TaxException = {
    exceptionId: uuidv4(),
    returnId,
    accountId,
    type,
    details,
    status: "open",
    createdAt: new Date(),
  };

  exceptionStore.set(exception.exceptionId, exception);
  return exception;
}

/**
 * Get the exception queue for an account.
 */
export async function getExceptionQueue(
  accountId: string,
  status?: "open" | "resolved" | "escalated"
): Promise<TaxException[]> {
  return Array.from(exceptionStore.values()).filter(
    (e) =>
      e.accountId === accountId && (!status || e.status === status)
  );
}

/**
 * Resolve an exception.
 */
export async function resolveException(
  exceptionId: string,
  resolution: ExceptionResolution
): Promise<TaxException | null> {
  const exception = exceptionStore.get(exceptionId);
  if (!exception) return null;

  exception.status = resolution.escalate ? "escalated" : "resolved";
  exception.resolution = resolution.notes;
  exception.resolvedBy = resolution.resolvedBy;
  exception.resolvedAt = new Date();

  exceptionStore.set(exceptionId, exception);
  return exception;
}

/**
 * Get a single exception by ID.
 */
export async function getException(exceptionId: string): Promise<TaxException | null> {
  return exceptionStore.get(exceptionId) ?? null;
}
