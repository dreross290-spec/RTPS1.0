/**
 * Notification Preferences tRPC Router
 *
 * CRUD for per-client notification preferences with PII encryption/decryption,
 * TCPA consent management, and phone number validation.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import {
  notificationPreferences,
  tcpaConsent,
} from "../../drizzle/schema/index.js";
import { encrypt, decrypt } from "../../lib/utils/encryption.js";
import { maskPhone, maskEmail } from "../../lib/utils/masking.js";
import { validatePhone } from "../../lib/utils/phone-validation.js";
import { DEFAULT_EVENT_TYPE_PREFERENCES } from "../../lib/constants/refund-events.js";
import {
  updateNotificationPreferenceSchema,
  createNotificationPreferenceSchema,
} from "../../lib/schemas/preference.js";

// ─── Router ───────────────────────────────────────────────────────────────────

export const preferencesRouter = router({
  /**
   * Get notification preferences for a client, with PII masked for display.
   */
  get: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.clientId, input.clientId))
        .limit(1);

      const row = rows[0];
      if (row === undefined) {
        return null;
      }

      // Mask PII for response
      let maskedPhone: string | null = null;
      let maskedEmail: string | null = null;

      if (row.smsPhoneNumber !== null) {
        try {
          const rawPhone = decrypt(row.smsPhoneNumber);
          maskedPhone = maskPhone(rawPhone);
        } catch {
          maskedPhone = "[encrypted]";
        }
      }

      if (row.emailAddress !== null) {
        try {
          const rawEmail = decrypt(row.emailAddress);
          maskedEmail = maskEmail(rawEmail);
        } catch {
          maskedEmail = "[encrypted]";
        }
      }

      return {
        id: row.id,
        clientId: row.clientId,
        smsEnabled: row.smsEnabled,
        emailEnabled: row.emailEnabled,
        preferredContactHoursStart: row.preferredContactHoursStart,
        preferredContactHoursEnd: row.preferredContactHoursEnd,
        notificationFrequency: row.notificationFrequency,
        maskedPhone,
        maskedEmail,
        eventTypePreferences:
          (row.eventTypePreferences as Record<string, boolean> | null) ??
          DEFAULT_EVENT_TYPE_PREFERENCES,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }),

  /**
   * Create or update notification preferences. Encrypts phone/email PII before
   * writing to the database.
   */
  update: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        prefs: updateNotificationPreferenceSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { clientId, prefs } = input;

      // Encrypt contact details if provided
      const encryptedPhone =
        prefs.phoneNumber !== undefined ? encrypt(prefs.phoneNumber) : undefined;
      const encryptedEmail =
        prefs.emailAddress !== undefined ? encrypt(prefs.emailAddress) : undefined;

      // Check if record already exists
      const existing = await ctx.db
        .select({ id: notificationPreferences.id })
        .from(notificationPreferences)
        .where(eq(notificationPreferences.clientId, clientId))
        .limit(1);

      const now = new Date();

      if (existing.length === 0) {
        // Create – validate the full schema
        const full = createNotificationPreferenceSchema.parse({
          clientId,
          ...prefs,
        });

        await ctx.db.insert(notificationPreferences).values({
          clientId: full.clientId,
          smsEnabled: full.smsEnabled,
          emailEnabled: full.emailEnabled,
          preferredContactHoursStart: full.preferredContactHoursStart,
          preferredContactHoursEnd: full.preferredContactHoursEnd,
          notificationFrequency: full.notificationFrequency,
          smsPhoneNumber: encryptedPhone ?? null,
          emailAddress: encryptedEmail ?? null,
          eventTypePreferences:
            (full.eventTypePreferences as Record<string, unknown> | undefined) ?? null,
          updatedAt: now,
        });
      } else {
        // Update – only change provided fields
        const updatePayload: Record<string, unknown> = { updatedAt: now };

        if (prefs.smsEnabled !== undefined) updatePayload["smsEnabled"] = prefs.smsEnabled;
        if (prefs.emailEnabled !== undefined) updatePayload["emailEnabled"] = prefs.emailEnabled;
        if (prefs.preferredContactHoursStart !== undefined)
          updatePayload["preferredContactHoursStart"] = prefs.preferredContactHoursStart;
        if (prefs.preferredContactHoursEnd !== undefined)
          updatePayload["preferredContactHoursEnd"] = prefs.preferredContactHoursEnd;
        if (prefs.notificationFrequency !== undefined)
          updatePayload["notificationFrequency"] = prefs.notificationFrequency;
        if (encryptedPhone !== undefined) updatePayload["smsPhoneNumber"] = encryptedPhone;
        if (encryptedEmail !== undefined) updatePayload["emailAddress"] = encryptedEmail;
        if (prefs.eventTypePreferences !== undefined)
          updatePayload["eventTypePreferences"] = prefs.eventTypePreferences;

        await ctx.db
          .update(notificationPreferences)
          .set(updatePayload)
          .where(eq(notificationPreferences.clientId, clientId));
      }

      return { success: true, clientId };
    }),

  /**
   * Get the most recent active TCPA consent record for a client.
   */
  getTCPAConsent: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(tcpaConsent)
        .where(eq(tcpaConsent.clientId, input.clientId))
        .orderBy(tcpaConsent.consentDate)
        .limit(10);

      const activeConsent = rows.find((r) => r.revokedAt === null) ?? null;

      return {
        hasActiveConsent: activeConsent !== null,
        consentId: activeConsent?.id ?? null,
        consentDate: activeConsent?.consentDate ?? null,
        consentType: activeConsent?.consentType ?? null,
        maskedPhone: activeConsent?.phoneNumber ?? null,
        revokedAt: null,
      };
    }),

  /**
   * Revoke TCPA consent (opt-out). Sets revokedAt and disables SMS notifications.
   */
  revokeTCPAConsent: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        reason: z.string().min(1).max(500).default("User requested opt-out"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ id: tcpaConsent.id })
        .from(tcpaConsent)
        .where(eq(tcpaConsent.clientId, input.clientId))
        .limit(10);

      const active = rows.find(async (r) => {
        const full = await ctx.db
          .select({ revokedAt: tcpaConsent.revokedAt })
          .from(tcpaConsent)
          .where(eq(tcpaConsent.id, r.id))
          .limit(1);
        return full[0]?.revokedAt === null;
      });

      if (active === undefined) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active TCPA consent record found for this client.",
        });
      }

      const now = new Date();
      await ctx.db
        .update(tcpaConsent)
        .set({ revokedAt: now, revokedReason: input.reason })
        .where(eq(tcpaConsent.clientId, input.clientId));

      // Also disable SMS notifications
      await ctx.db
        .update(notificationPreferences)
        .set({ smsEnabled: false, updatedAt: now })
        .where(eq(notificationPreferences.clientId, input.clientId));

      return {
        success: true,
        revokedAt: now.toISOString(),
        message: "TCPA consent revoked. SMS notifications have been disabled.",
      };
    }),

  /**
   * Validate a phone number and return the normalized E.164 form.
   */
  validatePhoneNumber: protectedProcedure
    .input(z.object({ phone: z.string().min(1) }))
    .query(({ input }) => {
      const result = validatePhone(input.phone);
      return {
        valid: result.valid,
        normalized: result.normalized ?? null,
        error: result.error ?? null,
      };
    }),
});
