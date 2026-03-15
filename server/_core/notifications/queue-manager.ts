/**
 * Notification Queue Manager
 *
 * Manages the lifecycle of outbound notifications in the notification_queue
 * table: enqueueing, dequeueing for processing, marking success/failure,
 * dead-letter handling, and deduplication.
 */

import { eq, and, lte, sql, isNull, or, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../../../drizzle/schema/index.js";
import {
  notificationQueue,
  notificationEvents,
} from "../../../drizzle/schema/index.js";
import type { NotificationQueueItem, SmsQueuePayload, EmailQueuePayload } from "./types.js";

type AppDB = PostgresJsDatabase<typeof schema>;

// ─── Manager ──────────────────────────────────────────────────────────────────

export class QueueManager {
  private readonly db: AppDB;

  constructor(db: AppDB) {
    this.db = db;
  }

  /**
   * Adds a notification to the queue.
   * Performs deduplication: skips if an equivalent item already exists in
   * pending/sent/processing state for the same event + client + channel.
   */
  async enqueue(item: NotificationQueueItem): Promise<void> {
    const isDuplicate = await this.isDuplicate(
      item.notificationEventId,
      item.clientId,
      item.channel,
    );

    if (isDuplicate) {
      this.log("info", `Skipping duplicate: eventId=${item.notificationEventId} channel=${item.channel}`);
      return;
    }

    await this.db.insert(notificationQueue).values({
      id: item.id,
      notificationEventId: item.notificationEventId,
      clientId: item.clientId,
      channel: item.channel,
      payload: item.payload as unknown as Record<string, unknown>,
      status: item.status,
      attemptCount: item.attemptCount,
      maxRetries: item.maxRetries,
      scheduledFor: item.scheduledFor,
      lastAttemptAt: item.lastAttemptAt,
      lastError: item.lastError,
    });
  }

  /**
   * Dequeues a batch of items ready for processing.
   * Selects pending/scheduled items (scheduled ones only if their time has come),
   * and transitions them to "processing" atomically.
   */
  async dequeue(batchSize: number): Promise<NotificationQueueItem[]> {
    const now = new Date();

    // Select up to batchSize items that are ready
    const rows = await this.db
      .select()
      .from(notificationQueue)
      .where(
        or(
          eq(notificationQueue.status, "pending"),
          and(
            eq(notificationQueue.status, "scheduled"),
            lte(notificationQueue.scheduledFor, now),
          ),
        ),
      )
      .limit(batchSize)
      .for("update", { skipLocked: true });

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);

    // Atomically mark as processing
    await this.db
      .update(notificationQueue)
      .set({ status: "processing", updatedAt: new Date() })
      .where(inArray(notificationQueue.id, ids));

    return rows.map(mapRowToQueueItem);
  }

  /**
   * Marks a queue item as successfully sent and records the provider message ID.
   */
  async markSent(queueId: string, messageId: string): Promise<void> {
    await this.db
      .update(notificationQueue)
      .set({
        status: "sent",
        updatedAt: new Date(),
        lastAttemptAt: new Date(),
      })
      .where(eq(notificationQueue.id, queueId));

    // Update the linked notification_events row with the provider message ID
    const queueRows = await this.db
      .select({ notificationEventId: notificationQueue.notificationEventId })
      .from(notificationQueue)
      .where(eq(notificationQueue.id, queueId))
      .limit(1);

    const queueRow = queueRows[0];
    if (queueRow !== undefined) {
      await this.db
        .update(notificationEvents)
        .set({
          status: "sent",
          providerMessageId: messageId,
          updatedAt: new Date(),
        })
        .where(eq(notificationEvents.id, queueRow.notificationEventId));
    }
  }

  /**
   * Marks a queue item as failed.  If retries are exhausted, transitions to
   * terminal "failed" state; otherwise resets to "pending" for retry.
   */
  async markFailed(
    queueId: string,
    reason: string,
    retryCount: number,
  ): Promise<void> {
    const rows = await this.db
      .select({
        maxRetries: notificationQueue.maxRetries,
        attemptCount: notificationQueue.attemptCount,
      })
      .from(notificationQueue)
      .where(eq(notificationQueue.id, queueId))
      .limit(1);

    const row = rows[0];
    const maxRetries = row?.maxRetries ?? 3;
    const exhausted = retryCount >= maxRetries;

    await this.db
      .update(notificationQueue)
      .set({
        status: exhausted ? "failed" : "pending",
        attemptCount: retryCount,
        lastAttemptAt: new Date(),
        lastError: reason.slice(0, 2000),
        updatedAt: new Date(),
        ...(exhausted ? { processedAt: new Date() } : {}),
      })
      .where(eq(notificationQueue.id, queueId));
  }

  /**
   * Returns all items that have exceeded maxRetries (dead-letter queue view).
   */
  async getDeadLetterItems(): Promise<NotificationQueueItem[]> {
    const rows = await this.db
      .select()
      .from(notificationQueue)
      .where(eq(notificationQueue.status, "failed"));

    return rows.map(mapRowToQueueItem);
  }

  /**
   * Returns items in "processing" state that haven't been updated recently
   * (likely stuck/orphaned workers).
   *
   * @param staleAfterMinutes - Items processing for longer than this are considered stale.
   */
  async getStaleProcessingItems(staleAfterMinutes = 15): Promise<NotificationQueueItem[]> {
    const cutoff = new Date(Date.now() - staleAfterMinutes * 60 * 1000);

    const rows = await this.db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.status, "processing"),
          lte(notificationQueue.updatedAt, cutoff),
        ),
      );

    return rows.map(mapRowToQueueItem);
  }

  /**
   * Requeues stale processing items back to pending for retry.
   */
  async requeueStaleItems(staleAfterMinutes = 15): Promise<number> {
    const stale = await this.getStaleProcessingItems(staleAfterMinutes);
    if (stale.length === 0) return 0;

    const ids = stale.map((s) => s.id);
    await this.db
      .update(notificationQueue)
      .set({ status: "pending", updatedAt: new Date() })
      .where(inArray(notificationQueue.id, ids));

    return stale.length;
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async isDuplicate(
    notificationEventId: string,
    clientId: string,
    channel: "sms" | "email",
  ): Promise<boolean> {
    const existing = await this.db
      .select({ id: notificationQueue.id })
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.notificationEventId, notificationEventId),
          eq(notificationQueue.clientId, clientId),
          eq(notificationQueue.channel, channel),
          inArray(notificationQueue.status, ["pending", "processing", "sent", "scheduled"]),
        ),
      )
      .limit(1);

    return existing.length > 0;
  }

  private log(level: "info" | "warn" | "error", message: string): void {
    console.log(JSON.stringify({
      level,
      service: "QueueManager",
      message,
      ts: new Date().toISOString(),
    }));
  }
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapRowToQueueItem(
  row: typeof notificationQueue.$inferSelect,
): NotificationQueueItem {
  return {
    id: row.id,
    notificationEventId: row.notificationEventId,
    clientId: row.clientId,
    channel: row.channel,
    payload: row.payload as SmsQueuePayload | EmailQueuePayload,
    status: row.status,
    attemptCount: row.attemptCount,
    maxRetries: row.maxRetries,
    scheduledFor: row.scheduledFor,
    lastAttemptAt: row.lastAttemptAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
  };
}
