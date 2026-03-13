/**
 * SMS template rendering
 *
 * Combines the static template strings from sms-templates constants with the
 * renderer utility to produce final outbound SMS message bodies.
 *
 * All public functions here produce ready-to-send message bodies; the opt-out
 * footer is appended automatically.
 */

import type { RefundEventType } from "../constants/refund-events.js";
import {
  SMS_TEMPLATES,
  appendOptOutFooter,
  SMS_MAX_SINGLE_SEGMENT_LENGTH,
  type SmsRefundApprovedVars,
  type SmsRefundSentVars,
  type SmsRefundDepositedVars,
  type SmsRefundRejectedVars,
  type SmsAdditionalInfoVars,
  type SmsOffsetAppliedVars,
  type SmsTemplateBaseVars,
} from "../constants/sms-templates.js";

/** Variables required to render an SMS for a given event. */
export interface SmsRenderInput {
  eventType: RefundEventType;
  firstName: string;
  taxYear: string;
  refundAmount?: string;
  expectedDate?: string;
  reason?: string;
  infoNeeded?: string;
  deadline?: string;
  offsetAmount?: string;
  netAmount?: string;
}

/** The rendered output, ready for the Twilio client. */
export interface RenderedSms {
  body: string;
  /** Whether the message body fits in a single 160-character SMS segment. */
  isSingleSegment: boolean;
  /** Total character count (including opt-out footer). */
  characterCount: number;
}

/**
 * Renders the SMS body for a given refund event.
 *
 * Selects the appropriate template function, substitutes variables, and
 * appends the mandatory TCPA opt-out footer.
 *
 * @param input - Event type and dynamic variable values.
 * @returns Rendered SMS body with opt-out footer.
 * @throws {Error} When a required variable for the event type is missing.
 */
export function renderSms(input: SmsRenderInput): RenderedSms {
  const base: SmsTemplateBaseVars = {
    firstName: input.firstName || "Taxpayer",
    taxYear: input.taxYear,
  };

  let rawBody: string;

  switch (input.eventType) {
    case "RETURN_RECEIVED":
      rawBody = SMS_TEMPLATES.RETURN_RECEIVED(base);
      break;

    case "RETURN_PROCESSING":
      rawBody = SMS_TEMPLATES.RETURN_PROCESSING(base);
      break;

    case "REFUND_APPROVED": {
      assertVar(input.refundAmount, "refundAmount", input.eventType);
      assertVar(input.expectedDate, "expectedDate", input.eventType);
      const vars: SmsRefundApprovedVars = {
        ...base,
        refundAmount: input.refundAmount,
        expectedDate: input.expectedDate,
      };
      rawBody = SMS_TEMPLATES.REFUND_APPROVED(vars);
      break;
    }

    case "REFUND_SENT": {
      assertVar(input.refundAmount, "refundAmount", input.eventType);
      assertVar(input.expectedDate, "expectedDate", input.eventType);
      const vars: SmsRefundSentVars = {
        ...base,
        refundAmount: input.refundAmount,
        expectedDate: input.expectedDate,
      };
      rawBody = SMS_TEMPLATES.REFUND_SENT(vars);
      break;
    }

    case "REFUND_DEPOSITED": {
      assertVar(input.refundAmount, "refundAmount", input.eventType);
      const vars: SmsRefundDepositedVars = {
        ...base,
        refundAmount: input.refundAmount,
      };
      rawBody = SMS_TEMPLATES.REFUND_DEPOSITED(vars);
      break;
    }

    case "REFUND_REJECTED": {
      assertVar(input.reason, "reason", input.eventType);
      const vars: SmsRefundRejectedVars = {
        ...base,
        reason: input.reason,
      };
      rawBody = SMS_TEMPLATES.REFUND_REJECTED(vars);
      break;
    }

    case "ADDITIONAL_INFO_REQUIRED": {
      assertVar(input.infoNeeded, "infoNeeded", input.eventType);
      assertVar(input.deadline, "deadline", input.eventType);
      const vars: SmsAdditionalInfoVars = {
        ...base,
        infoNeeded: input.infoNeeded,
        deadline: input.deadline,
      };
      rawBody = SMS_TEMPLATES.ADDITIONAL_INFO_REQUIRED(vars);
      break;
    }

    case "UNDER_REVIEW":
      rawBody = SMS_TEMPLATES.UNDER_REVIEW(base);
      break;

    case "OFFSET_APPLIED": {
      assertVar(input.refundAmount, "refundAmount", input.eventType);
      assertVar(input.offsetAmount, "offsetAmount", input.eventType);
      assertVar(input.netAmount, "netAmount", input.eventType);
      const vars: SmsOffsetAppliedVars = {
        ...base,
        refundAmount: input.refundAmount,
        offsetAmount: input.offsetAmount,
        netAmount: input.netAmount,
      };
      rawBody = SMS_TEMPLATES.OFFSET_APPLIED(vars);
      break;
    }

    case "AMENDED_RETURN_PROCESSING":
      rawBody = SMS_TEMPLATES.AMENDED_RETURN_PROCESSING(base);
      break;

    case "CANCELLED":
      rawBody = SMS_TEMPLATES.CANCELLED(base);
      break;

    default: {
      const _exhaustive: never = input.eventType;
      throw new Error(`Unknown RefundEventType: ${String(_exhaustive)}`);
    }
  }

  const body = appendOptOutFooter(rawBody);
  const characterCount = body.length;

  return {
    body,
    isSingleSegment: characterCount <= SMS_MAX_SINGLE_SEGMENT_LENGTH,
    characterCount,
  };
}

/**
 * Asserts that a required template variable is present.
 * Throws a descriptive error if the value is missing.
 */
function assertVar(
  value: string | undefined,
  varName: string,
  eventType: string,
): asserts value is string {
  if (!value || value.trim() === "") {
    throw new Error(
      `SMS template for event "${eventType}" requires "${varName}" but it was not provided or was empty.`,
    );
  }
}
