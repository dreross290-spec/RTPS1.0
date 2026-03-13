/**
 * Refund event type constants
 *
 * These values map to status transitions in refund_status_history and are used
 * as keys in notification_preferences.eventTypePreferences to allow per-event
 * opt-in/out.  They are also the canonical discriminants for SMS and email
 * template selection.
 */

/** Exhaustive list of refund lifecycle event types. */
export const RefundEventType = {
  /** The IRS or state authority has received the tax return. */
  RETURN_RECEIVED: "RETURN_RECEIVED",

  /** The return is actively being processed. */
  RETURN_PROCESSING: "RETURN_PROCESSING",

  /** The refund has been approved. */
  REFUND_APPROVED: "REFUND_APPROVED",

  /** The refund payment has been issued (check mailed or ACH initiated). */
  REFUND_SENT: "REFUND_SENT",

  /** The refund has been deposited into the client's account. */
  REFUND_DEPOSITED: "REFUND_DEPOSITED",

  /** The refund or return was rejected; action required. */
  REFUND_REJECTED: "REFUND_REJECTED",

  /** The authority needs additional information from the client. */
  ADDITIONAL_INFO_REQUIRED: "ADDITIONAL_INFO_REQUIRED",

  /** The return has been selected for review (audit / exam). */
  UNDER_REVIEW: "UNDER_REVIEW",

  /**
   * A debt offset was applied to the refund (e.g., unpaid student loans,
   * child support, other federal/state debts).
   */
  OFFSET_APPLIED: "OFFSET_APPLIED",

  /** An amended return (1040-X) is being processed. */
  AMENDED_RETURN_PROCESSING: "AMENDED_RETURN_PROCESSING",

  /** The refund request has been cancelled. */
  CANCELLED: "CANCELLED",
} as const;

/** Union type of all event type string values. */
export type RefundEventType = (typeof RefundEventType)[keyof typeof RefundEventType];

/** Ordered list of all event type values (useful for iteration / validation). */
export const ALL_REFUND_EVENT_TYPES: readonly RefundEventType[] = Object.values(
  RefundEventType,
) as RefundEventType[];

/**
 * Human-readable display names for each event type.
 * Used in email subject lines and notification logs.
 */
export const REFUND_EVENT_DISPLAY_NAMES: Readonly<Record<RefundEventType, string>> = {
  [RefundEventType.RETURN_RECEIVED]: "Return Received",
  [RefundEventType.RETURN_PROCESSING]: "Return Being Processed",
  [RefundEventType.REFUND_APPROVED]: "Refund Approved",
  [RefundEventType.REFUND_SENT]: "Refund Sent",
  [RefundEventType.REFUND_DEPOSITED]: "Refund Deposited",
  [RefundEventType.REFUND_REJECTED]: "Refund Rejected",
  [RefundEventType.ADDITIONAL_INFO_REQUIRED]: "Additional Information Required",
  [RefundEventType.UNDER_REVIEW]: "Under Review",
  [RefundEventType.OFFSET_APPLIED]: "Offset Applied",
  [RefundEventType.AMENDED_RETURN_PROCESSING]: "Amended Return Processing",
  [RefundEventType.CANCELLED]: "Refund Cancelled",
};

/**
 * Default opt-in map.  All events are enabled by default; clients may
 * override individual events via their notification preferences.
 */
export const DEFAULT_EVENT_TYPE_PREFERENCES: Readonly<Record<RefundEventType, boolean>> =
  Object.fromEntries(
    ALL_REFUND_EVENT_TYPES.map((evt) => [evt, true]),
  ) as Record<RefundEventType, boolean>;

/**
 * Events that should always be delivered regardless of client opt-in
 * (regulatory / high-urgency events).
 */
export const MANDATORY_NOTIFICATION_EVENTS: ReadonlySet<RefundEventType> = new Set<RefundEventType>(
  [
    RefundEventType.REFUND_REJECTED,
    RefundEventType.ADDITIONAL_INFO_REQUIRED,
    RefundEventType.OFFSET_APPLIED,
  ],
);
