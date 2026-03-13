import twilio from "twilio";
import sgMail from "@sendgrid/mail";
import { db } from "@server/lib/db";
import {
  taxReturns,
  clients,
  notificationLog,
  notificationTemplates,
  refundStatusHistory,
} from "@/drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  pollTranscript,
  detectStatusChange,
} from "@server/_core/integrations/irs/transcript-service";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RefundEventType =
  | "return_accepted"
  | "refund_approved"
  | "payment_issued"
  | "direct_deposit_sent"
  | "check_mailed"
  | "refund_delayed"
  | "additional_info_required";

export interface RefundEvent {
  type: RefundEventType;
  returnId: string;
  clientId: string;
  taxYear: number;
  refundAmount?: number;
  expectedDate?: Date;
  message?: string;
}

export interface NotificationTemplate {
  subject?: string;
  body: string;
}

export interface LogNotificationParams {
  returnId: string;
  clientId: string;
  event: string;
  channel: "sms" | "email";
  recipient: string;
  subject?: string;
  body: string;
  status: "sent" | "failed" | "opted_out";
  externalId?: string;
  errorMessage?: string;
}

// ── Twilio & SendGrid Init ────────────────────────────────────────────────────

function getTwilioClient(): twilio.Twilio {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials not configured.");
  return twilio(sid, token);
}

function initSendGrid(): void {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SendGrid API key not configured.");
  sgMail.setApiKey(key);
}

// ── Main Poll Loop ────────────────────────────────────────────────────────────

/**
 * Poll all active (transmitted) returns for IRS refund status updates.
 * Call this on a scheduled interval (e.g., every 60 minutes via cron/worker).
 */
export async function pollAllActiveReturns(): Promise<void> {
  const activeReturns = await db
    .select({
      returnId: taxReturns.returnId,
      clientId: taxReturns.clientId,
      taxYear: taxReturns.taxYear,
      refundStatus: taxReturns.refundStatus,
    })
    .from(taxReturns)
    .where(
      and(
        // Only check returns that have been accepted by IRS
        eq(taxReturns.transmittalStatus, "accepted")
      )
    );

  console.log(`[RefundWorker] Checking ${activeReturns.length} active returns...`);

  for (const ret of activeReturns) {
    try {
      await checkRefundStatus(ret.returnId);
    } catch (err) {
      console.error(
        `[RefundWorker] Error checking return ${ret.returnId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

/**
 * Check and update refund status for a single return.
 */
export async function checkRefundStatus(returnId: string): Promise<void> {
  const ret = await db.query.taxReturns.findFirst({
    where: eq(taxReturns.returnId, returnId),
  });

  if (!ret) return;

  const client = await db.query.clients.findFirst({
    where: eq(clients.clientId, ret.clientId),
  });

  if (!client) return;

  const transcriptResult = await pollTranscript(
    client.ssnEncrypted,
    ret.taxYear
  );

  if (!transcriptResult.success || !transcriptResult.refundStatus) return;

  const changed = await detectStatusChange(
    returnId,
    ret.refundStatus,
    transcriptResult.refundStatus,
    transcriptResult.refundAmount
  );

  if (changed) {
    await processStatusChange(
      returnId,
      ret.refundStatus ?? null,
      transcriptResult.refundStatus,
      {
        refundAmount: transcriptResult.refundAmount
          ? parseFloat(transcriptResult.refundAmount)
          : undefined,
        expectedDate: transcriptResult.expectedDate
          ? new Date(transcriptResult.expectedDate)
          : undefined,
      }
    );
  }
}

/**
 * Handle a detected status change: fire notifications.
 */
export async function processStatusChange(
  returnId: string,
  oldStatus: string | null,
  newStatus: string,
  refundData: { refundAmount?: number; expectedDate?: Date }
): Promise<void> {
  const ret = await db.query.taxReturns.findFirst({
    where: eq(taxReturns.returnId, returnId),
  });

  if (!ret) return;

  const client = await db.query.clients.findFirst({
    where: eq(clients.clientId, ret.clientId),
  });

  if (!client) return;

  const event: RefundEvent = {
    type: mapStatusToEvent(newStatus),
    returnId,
    clientId: ret.clientId,
    taxYear: ret.taxYear,
    refundAmount: refundData.refundAmount,
    expectedDate: refundData.expectedDate,
  };

  const prefs = client.notificationPreferences ?? "both";
  const optedOut = client.smsOptOut === "true";

  if ((prefs === "sms" || prefs === "both") && !optedOut && client.phone) {
    const template = await getNotificationTemplate(event.type, "sms", ret.accountId);
    await sendSMSNotification(ret.clientId, event, template, client.phone);
  }

  if ((prefs === "email" || prefs === "both") && client.email) {
    const template = await getNotificationTemplate(event.type, "email", ret.accountId);
    await sendEmailNotification(ret.clientId, event, template, client.email);
  }

  // Mark notification as sent in history
  await db
    .update(refundStatusHistory)
    .set({ notificationSent: true })
    .where(
      and(
        eq(refundStatusHistory.returnId, returnId),
        eq(refundStatusHistory.newStatus, newStatus)
      )
    );
}

// ── SMS via Twilio ────────────────────────────────────────────────────────────

/**
 * Send an SMS notification with TCPA compliance check.
 */
export async function sendSMSNotification(
  clientId: string,
  event: RefundEvent,
  template: NotificationTemplate,
  phoneNumber: string
): Promise<void> {
  // TCPA compliance: re-check opt-out immediately before sending
  if (await isClientOptedOut(clientId, "sms")) {
    await logNotification({
      returnId: event.returnId,
      clientId,
      event: event.type,
      channel: "sms",
      recipient: phoneNumber,
      body: template.body,
      status: "opted_out",
    });
    return;
  }

  const body = renderTemplate(template.body, buildTemplateVariables(event));

  try {
    const twilioClient = getTwilioClient();
    const message = await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER!,
      to: phoneNumber,
      // TCPA: use messaging service SID for campaign-based compliance if configured
      ...(process.env.TWILIO_MESSAGING_SERVICE_SID
        ? { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }
        : {}),
    });

    await logNotification({
      returnId: event.returnId,
      clientId,
      event: event.type,
      channel: "sms",
      recipient: phoneNumber,
      body,
      status: "sent",
      externalId: message.sid,
    });
  } catch (err) {
    await logNotification({
      returnId: event.returnId,
      clientId,
      event: event.type,
      channel: "sms",
      recipient: phoneNumber,
      body,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Email via SendGrid ────────────────────────────────────────────────────────

/**
 * Send an email notification via SendGrid.
 */
export async function sendEmailNotification(
  clientId: string,
  event: RefundEvent,
  template: NotificationTemplate,
  emailAddress: string
): Promise<void> {
  if (await isClientOptedOut(clientId, "email")) {
    await logNotification({
      returnId: event.returnId,
      clientId,
      event: event.type,
      channel: "email",
      recipient: emailAddress,
      subject: template.subject,
      body: template.body,
      status: "opted_out",
    });
    return;
  }

  const subject = renderTemplate(template.subject ?? "Your Tax Return Status Update", buildTemplateVariables(event));
  const body = renderTemplate(template.body, buildTemplateVariables(event));

  try {
    initSendGrid();
    const [response] = await sgMail.send({
      to: emailAddress,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL ?? "noreply@rtps.example.com",
        name: process.env.SENDGRID_FROM_NAME ?? "RTPS Tax Services",
      },
      subject,
      html: body,
      // Track opens and clicks
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
      },
    });

    await logNotification({
      returnId: event.returnId,
      clientId,
      event: event.type,
      channel: "email",
      recipient: emailAddress,
      subject,
      body,
      status: "sent",
      externalId: response.headers["x-message-id"] as string | undefined,
    });
  } catch (err) {
    await logNotification({
      returnId: event.returnId,
      clientId,
      event: event.type,
      channel: "email",
      recipient: emailAddress,
      subject,
      body,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Template System ───────────────────────────────────────────────────────────

/**
 * Retrieve a notification template for an event, channel, and account.
 * Falls back to default templates if no custom template exists.
 */
export async function getNotificationTemplate(
  event: string,
  channel: "sms" | "email",
  accountId: string
): Promise<NotificationTemplate> {
  // Try account-specific template first
  const custom = await db.query.notificationTemplates.findFirst({
    where: and(
      eq(notificationTemplates.accountId, accountId),
      eq(notificationTemplates.event, event),
      eq(notificationTemplates.channel, channel)
    ),
  });

  if (custom) return { subject: custom.subject ?? undefined, body: custom.body };

  // Fall back to default template
  const defaults =
    channel === "sms" ? getDefaultSMSTemplates() : getDefaultEmailTemplates();
  return defaults[event] ?? { body: "Your tax return status has been updated." };
}

/**
 * Interpolate template variables into a template string.
 * Variables are in the format {{variableName}}.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

// ── Opt-Out ───────────────────────────────────────────────────────────────────

/**
 * Check whether a client has opted out of a specific notification channel.
 * Always checks the database to ensure latest preference is used (TCPA compliance).
 */
export async function isClientOptedOut(
  clientId: string,
  channel: "sms" | "email"
): Promise<boolean> {
  const client = await db.query.clients.findFirst({
    where: eq(clients.clientId, clientId),
  });

  if (!client) return true; // Opt-out unknown clients for safety

  if (channel === "sms") {
    return client.smsOptOut === "true" || client.notificationPreferences === "none";
  }

  return client.notificationPreferences === "none";
}

// ── Audit Logging ─────────────────────────────────────────────────────────────

export async function logNotification(params: LogNotificationParams): Promise<void> {
  await db.insert(notificationLog).values({
    returnId: params.returnId,
    clientId: params.clientId,
    event: params.event,
    channel: params.channel,
    recipient: params.recipient,
    subject: params.subject,
    body: params.body,
    status: params.status,
    externalId: params.externalId,
    errorMessage: params.errorMessage,
    sentAt: params.status === "sent" ? new Date() : undefined,
  });
}

// ── Default Templates ─────────────────────────────────────────────────────────

export function getDefaultSMSTemplates(): Record<string, NotificationTemplate> {
  return {
    return_accepted: {
      body: "Great news! Your {{taxYear}} federal tax return has been accepted by the IRS. Reply STOP to opt out.",
    },
    refund_approved: {
      body: "Your tax refund of ${{refundAmount}} has been approved! Expected by {{expectedDate}}. Reply STOP to opt out.",
    },
    payment_issued: {
      body: "Your IRS refund of ${{refundAmount}} has been issued. You should receive it within 5 days. Reply STOP to opt out.",
    },
    direct_deposit_sent: {
      body: "Your {{taxYear}} tax refund of ${{refundAmount}} has been sent via direct deposit. It will appear in 1-5 business days. Reply STOP to opt out.",
    },
    check_mailed: {
      body: "Your {{taxYear}} tax refund check of ${{refundAmount}} has been mailed. Please allow 3-6 weeks for delivery. Reply STOP to opt out.",
    },
    refund_delayed: {
      body: "Your {{taxYear}} tax refund is delayed. The IRS is reviewing your return. Contact your preparer for details. Reply STOP to opt out.",
    },
    additional_info_required: {
      body: "The IRS requires additional information for your {{taxYear}} return. Please contact your tax preparer immediately. Reply STOP to opt out.",
    },
  };
}

export function getDefaultEmailTemplates(): Record<string, NotificationTemplate> {
  return {
    return_accepted: {
      subject: "✅ Your {{taxYear}} Tax Return Has Been Accepted",
      body: `
        <h2>Your Tax Return Has Been Accepted</h2>
        <p>Great news! Your {{taxYear}} federal tax return has been accepted by the IRS.</p>
        <p>Your refund of <strong>\${{refundAmount}}</strong> is being processed.</p>
        <p>Expected deposit date: <strong>{{expectedDate}}</strong></p>
        <hr>
        <p style="font-size:11px;color:#888;">
          To unsubscribe from email notifications, 
          <a href="{{unsubscribeUrl}}">click here</a>.
        </p>
      `,
    },
    refund_approved: {
      subject: "💰 Your Tax Refund Has Been Approved – \${{refundAmount}}",
      body: `
        <h2>Your Refund Has Been Approved!</h2>
        <p>The IRS has approved your {{taxYear}} tax refund of <strong>\${{refundAmount}}</strong>.</p>
        <p>Expected payment date: <strong>{{expectedDate}}</strong></p>
        <hr>
        <p style="font-size:11px;color:#888;">
          <a href="{{unsubscribeUrl}}">Unsubscribe</a> from these notifications.
        </p>
      `,
    },
    payment_issued: {
      subject: "🎉 Your Tax Refund Has Been Issued!",
      body: `
        <h2>Refund Issued</h2>
        <p>The IRS has issued your {{taxYear}} refund of <strong>\${{refundAmount}}</strong>.</p>
        <p>It should arrive within 1–5 business days.</p>
        <hr>
        <p style="font-size:11px;color:#888;"><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
      `,
    },
    direct_deposit_sent: {
      subject: "🏦 Your Tax Refund Has Been Deposited",
      body: `
        <h2>Direct Deposit Sent</h2>
        <p>Your {{taxYear}} refund of <strong>\${{refundAmount}}</strong> has been sent via direct deposit.</p>
        <p>Please allow 1–5 business days for your bank to process it.</p>
        <hr>
        <p style="font-size:11px;color:#888;"><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
      `,
    },
    check_mailed: {
      subject: "📬 Your Refund Check Has Been Mailed",
      body: `
        <h2>Refund Check Mailed</h2>
        <p>The IRS has mailed your {{taxYear}} refund check for <strong>\${{refundAmount}}</strong>.</p>
        <p>Please allow 3–6 weeks for delivery.</p>
        <hr>
        <p style="font-size:11px;color:#888;"><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
      `,
    },
    refund_delayed: {
      subject: "⚠️ Your Tax Refund Is Delayed",
      body: `
        <h2>Refund Delay Notice</h2>
        <p>Your {{taxYear}} tax refund has been delayed. The IRS is reviewing your return.</p>
        <p>This may take 6–8 weeks from the original filing date.</p>
        <p>Please contact your tax preparer if you have questions.</p>
        <hr>
        <p style="font-size:11px;color:#888;"><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
      `,
    },
    additional_info_required: {
      subject: "⚠️ IRS Requires Additional Information",
      body: `
        <h2>Action Required</h2>
        <p>The IRS requires additional information to process your {{taxYear}} tax return.</p>
        <p>Please contact your tax preparer <strong>immediately</strong> to resolve this.</p>
        <hr>
        <p style="font-size:11px;color:#888;"><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
      `,
    },
  };
}

// ── Private Helpers ───────────────────────────────────────────────────────────

function mapStatusToEvent(status: string): RefundEventType {
  const statusMap: Record<string, RefundEventType> = {
    return_received: "return_accepted",
    return_approved: "refund_approved",
    refund_sent: "payment_issued",
    direct_deposit_sent: "direct_deposit_sent",
    check_mailed: "check_mailed",
    refund_delayed: "refund_delayed",
    additional_info_required: "additional_info_required",
  };
  return statusMap[status] ?? "refund_approved";
}

function buildTemplateVariables(event: RefundEvent): Record<string, string> {
  return {
    taxYear: String(event.taxYear),
    refundAmount: event.refundAmount?.toFixed(2) ?? "0.00",
    expectedDate: event.expectedDate
      ? event.expectedDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "TBD",
    message: event.message ?? "",
    unsubscribeUrl: `${process.env.NEXTAUTH_URL}/notifications/unsubscribe?clientId=${event.clientId}`,
  };
}
