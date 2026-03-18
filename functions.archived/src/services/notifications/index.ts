/**
 * Unified Notification Service
 * Single entrypoint for all push notification sending
 * Records attempts, handles tokens gracefully, PHI-safe logging
 */
/* biome-ignore-all lint/performance/noNamespaceImport: module uses firebase-admin namespace API across legacy notification flows. */
/* biome-ignore-all lint/style/useConsistentTypeDefinitions: this legacy service keeps interface-style contracts pending broader module migration. */
/* biome-ignore-all lint/nursery/useMaxParams: record/send helper signatures are intentionally explicit for call-site clarity. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: orchestration combines dedupe, preference, token, and send pipelines. */
/* biome-ignore-all lint/suspicious/useAwait: async wrappers are retained for backward-compatible exported signatures. */
/* biome-ignore-all lint/suspicious/noExplicitAny: compatibility layer accepts heterogeneous data payloads from multiple clients. */
/* biome-ignore-all lint/style/noExportedImports: local import re-export pattern is retained for public API stability. */

import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { createTraceId } from "../../observability/correlation";
import { logger } from "../../observability/logger";
import { cleanupInvalidTokens } from "./cleanup";
import { shouldSendNotification } from "./preferences";
import { sendMulticast } from "./sender";
import { getUserTokens } from "./tokens";
import type {
  NotificationPayload,
  NotificationType,
  PushNotificationResult,
} from "./types";

// Re-export NotificationType for convenience
export type { NotificationType };

const DEFAULT_DEDUPE_WINDOW_MINUTES = 5;
const DEDUPE_WINDOW_BY_TYPE: Partial<Record<NotificationType, number>> = {
  fall: 5,
  symptom: 5,
  vital: 5,
  medication: 10,
  trend: 60,
  family: 5,
  general: 24 * 60, // 24 hours for general notifications (includes weekly_summary)
};

/**
 * Notification send options
 */
export interface SendNotificationOptions {
  traceId?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  type?: NotificationType;
  priority?: "high" | "normal";
  sound?: string;
  badge?: number;
  imageUrl?: string;
  clickAction?: string;
  color?: string;
}

/**
 * Send result
 */
export interface SendNotificationResult {
  success: boolean;
  sent: number;
  failed: number;
  skipped: number;
  errors?: string[];
}

/**
 * Notification attempt status
 */
type NotificationAttemptStatus = "sent" | "failed" | "skipped";

function getDedupeWindowMinutes(notificationType: NotificationType): number {
  return (
    DEDUPE_WINDOW_BY_TYPE[notificationType] ?? DEFAULT_DEDUPE_WINDOW_MINUTES
  );
}

function getDedupeKey(
  notificationType: NotificationType,
  notification: NotificationPayload
): string | null {
  const data = notification.data ?? {};
  const dedupeKey =
    typeof data.dedupeKey === "string" ? data.dedupeKey.trim() : "";
  if (dedupeKey) {
    return `${notificationType}:key:${dedupeKey}`;
  }

  const tag =
    typeof notification.tag === "string" ? notification.tag.trim() : "";
  if (tag) {
    return `${notificationType}:tag:${tag}`;
  }

  const candidates: [string, unknown][] = [
    ["alertId", data.alertId],
    ["medicationId", data.medicationId],
    ["symptomType", data.symptomType],
    ["vitalType", data.vitalType],
    ["trendType", data.trendType],
    ["type", data.type],
  ];

  for (const [label, value] of candidates) {
    if (typeof value === "string" && value.trim()) {
      return `${notificationType}:${label}:${value.trim()}`;
    }
    if (typeof value === "number") {
      return `${notificationType}:${label}:${value.toString()}`;
    }
  }

  const title = notification.title?.trim() ?? "";
  const body = notification.body?.trim() ?? "";
  if (title || body) {
    return `${notificationType}:message:${title}|${body}`;
  }

  return null;
}

async function shouldSendWithDedupe({
  userId,
  notificationType,
  notification,
  traceId,
}: {
  userId: string;
  notificationType: NotificationType;
  notification: NotificationPayload;
  traceId: string;
}): Promise<{ allowed: boolean; dedupeKey: string | null }> {
  const dedupeKey = getDedupeKey(notificationType, notification);
  if (!dedupeKey) {
    return { allowed: true, dedupeKey: null };
  }

  const windowMinutes = getDedupeWindowMinutes(notificationType);
  const cutoffTime = Timestamp.fromMillis(
    Date.now() - windowMinutes * 60 * 1000
  );

  const db = admin.firestore();
  const recentSnapshot = await db
    .collection("notificationDedupes")
    .where("userId", "==", userId)
    .where("dedupeKey", "==", dedupeKey)
    .where("sentAt", ">=", cutoffTime)
    .limit(1)
    .get();

  if (!recentSnapshot.empty) {
    logger.info("Skipping duplicate notification", {
      traceId,
      uid: userId,
      notificationType,
      dedupeKey,
      windowMinutes,
      fn: "shouldSendWithDedupe",
    });
    return { allowed: false, dedupeKey };
  }

  return { allowed: true, dedupeKey };
}

async function recordNotificationDedupe({
  traceId,
  userIds,
  notificationType,
  dedupeKey,
}: {
  traceId: string;
  userIds: string[];
  notificationType: NotificationType;
  dedupeKey: string;
}): Promise<void> {
  if (userIds.length === 0) {
    return;
  }

  try {
    const db = admin.firestore();
    const batch = db.batch();

    for (const userId of userIds) {
      const docRef = db.collection("notificationDedupes").doc();
      batch.set(docRef, {
        traceId,
        userId,
        notificationType,
        dedupeKey,
        sentAt: Timestamp.now(),
      });
    }

    await batch.commit();
  } catch (error) {
    logger.warn("Failed to record notification dedupe", error as Error, {
      traceId,
      notificationType,
      fn: "recordNotificationDedupe",
    });
  }
}

/**
 * Record a notification attempt in Firestore
 */
async function recordNotificationAttempt(
  traceId: string,
  userId: string,
  type: NotificationType,
  status: NotificationAttemptStatus,
  tokensCount: number,
  reason?: string
): Promise<void> {
  try {
    const db = admin.firestore();
    await db.collection("notificationAttempts").add({
      traceId,
      userId,
      type,
      status,
      tokensCount,
      reason: reason || null,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    // Don't fail notification if logging fails
    logger.warn("Failed to record notification attempt", error as Error, {
      traceId,
      uid: userId,
      fn: "recordNotificationAttempt",
    });
  }
}

/**
 * Send notification to a single user
 *
 * @param userId - User ID to send to
 * @param options - Notification options
 * @returns Send result
 */
export async function sendToUser(
  userId: string,
  options: SendNotificationOptions
): Promise<SendNotificationResult> {
  const traceId =
    options.traceId || Math.random().toString(36).substring(2, 15);
  const type = options.type || "general";

  logger.info("Sending notification to user", {
    traceId,
    uid: userId,
    type,
    fn: "sendToUser",
  });

  try {
    const dedupeResult = await shouldSendWithDedupe({
      userId,
      notificationType: type,
      notification: options,
      traceId,
    });

    if (!dedupeResult.allowed) {
      await recordNotificationAttempt(
        traceId,
        userId,
        type,
        "skipped",
        0,
        "Duplicate notification within cooldown window"
      );

      return {
        success: true,
        sent: 0,
        failed: 0,
        skipped: 1,
      };
    }

    // Get FCM tokens for user
    const tokens = await getUserTokens(userId);

    if (tokens.length === 0) {
      logger.info("No FCM tokens for user, skipping", {
        traceId,
        uid: userId,
        type,
        fn: "sendToUser",
      });

      await recordNotificationAttempt(
        traceId,
        userId,
        type,
        "skipped",
        0,
        "No FCM tokens found"
      );

      return {
        success: true,
        sent: 0,
        failed: 0,
        skipped: 1,
      };
    }

    // Build FCM message
    const message = {
      notification: {
        title: options.title,
        body: options.body,
        imageUrl: options.imageUrl,
      },
      data: {
        ...options.data,
        type,
        timestamp: new Date().toISOString(),
        clickAction: options.clickAction || "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority:
          options.priority === "high" ? ("high" as const) : ("normal" as const),
        notification: {
          sound: options.sound || "default",
          priority:
            options.priority === "high"
              ? ("high" as const)
              : ("default" as const),
          channelId: type,
          color: options.color || "#2563EB",
          icon: "ic_notification",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: options.sound || "default",
            badge: options.badge !== undefined ? options.badge : 1,
            "mutable-content": 1,
            category: type.toUpperCase(),
          },
        },
        headers: {
          "apns-priority": options.priority === "high" ? "10" : "5",
        },
      },
      tokens,
    };

    // Send via FCM
    const response = await admin.messaging().sendEachForMulticast(message);

    // Handle failures
    const failedTokens: string[] = [];
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });

      // Clean up invalid tokens
      await cleanupInvalidTokens(failedTokens);
    }

    // Record attempt
    const status: NotificationAttemptStatus =
      response.successCount > 0 ? "sent" : "failed";
    await recordNotificationAttempt(
      traceId,
      userId,
      type,
      status,
      tokens.length,
      response.failureCount > 0
        ? `${response.failureCount} tokens failed`
        : undefined
    );

    logger.info("Notification sent to user", {
      traceId,
      uid: userId,
      type,
      sent: response.successCount,
      failed: response.failureCount,
      fn: "sendToUser",
    });

    if (response.successCount > 0 && dedupeResult.dedupeKey) {
      await recordNotificationDedupe({
        traceId,
        userIds: [userId],
        notificationType: type,
        dedupeKey: dedupeResult.dedupeKey,
      });
    }

    return {
      success: response.successCount > 0,
      sent: response.successCount,
      failed: response.failureCount,
      skipped: 0,
    };
  } catch (error) {
    logger.error("Failed to send notification to user", error as Error, {
      traceId,
      uid: userId,
      type,
      fn: "sendToUser",
    });

    await recordNotificationAttempt(
      traceId,
      userId,
      type,
      "failed",
      0,
      (error as Error).message
    );

    return {
      success: false,
      sent: 0,
      failed: 1,
      skipped: 0,
      errors: [(error as Error).message],
    };
  }
}

/**
 * Send notification to multiple users
 *
 * @param userIds - Array of user IDs to send to
 * @param options - Notification options
 * @returns Aggregated send result
 */
export async function sendToMany(
  userIds: string[],
  options: SendNotificationOptions
): Promise<SendNotificationResult> {
  const traceId =
    options.traceId || Math.random().toString(36).substring(2, 15);
  const type = options.type || "general";

  logger.info("Sending notification to multiple users", {
    traceId,
    type,
    userCount: userIds.length,
    fn: "sendToMany",
  });

  const result: SendNotificationResult = {
    success: false,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // Send to each user
  for (const userId of userIds) {
    try {
      const userResult = await sendToUser(userId, {
        ...options,
        traceId, // Share same traceId for correlation
      });

      result.sent += userResult.sent;
      result.failed += userResult.failed;
      result.skipped += userResult.skipped;

      if (userResult.errors) {
        result.errors?.push(...userResult.errors);
      }
    } catch (error) {
      logger.warn("Failed to send to user in batch", error as Error, {
        traceId,
        uid: userId,
        type,
        fn: "sendToMany",
      });

      result.failed += 1;
      result.errors?.push(`User ${userId}: ${(error as Error).message}`);
    }
  }

  result.success = result.sent > 0;

  logger.info("Notification sent to multiple users", {
    traceId,
    type,
    userCount: userIds.length,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
    fn: "sendToMany",
  });

  return result;
}

/**
 * Internal push notification function
 * This is the main function that should be used by all entrypoints
 *
 * @param options - Send options
 * @returns Result with counts and message
 */
export async function sendPushNotificationInternal({
  traceId,
  userIds,
  notification,
  notificationType,
  requireAuth,
  callerUid,
}: {
  traceId?: string;
  userIds: string[];
  notification: NotificationPayload;
  notificationType: NotificationType;
  requireAuth?: boolean;
  callerUid?: string;
}): Promise<PushNotificationResult> {
  const actualTraceId = traceId || createTraceId();

  logger.info("Push notification requested", {
    traceId: actualTraceId,
    uid: callerUid,
    userCount: userIds.length,
    notificationType,
    fn: "sendPushNotificationInternal",
  });

  try {
    // Check auth if required
    if (requireAuth && !callerUid) {
      logger.warn("Unauthenticated push notification attempt", {
        traceId: actualTraceId,
        fn: "sendPushNotificationInternal",
      });
      throw new Error("User must be authenticated");
    }

    // Filter users by preferences
    const tokens: string[] = [];
    const skippedUsers: string[] = [];
    const dedupedUsers: string[] = [];
    const eligibleUsers: string[] = [];
    let resolvedDedupeKey: string | null = null;

    for (const userId of userIds) {
      // Check preferences
      const shouldSend = await shouldSendNotification(userId, notificationType);

      if (shouldSend) {
        const dedupeResult = await shouldSendWithDedupe({
          userId,
          notificationType,
          notification,
          traceId: actualTraceId,
        });
        resolvedDedupeKey ??= dedupeResult.dedupeKey;

        if (!dedupeResult.allowed) {
          dedupedUsers.push(userId);
          continue;
        }

        // Get tokens for this user
        const userTokens = await getUserTokens(userId);
        if (userTokens.length > 0) {
          tokens.push(...userTokens);
          eligibleUsers.push(userId);
        } else {
          skippedUsers.push(userId);
        }
      } else {
        skippedUsers.push(userId);
      }
    }

    if (tokens.length === 0) {
      logger.info("No tokens to send to", {
        traceId: actualTraceId,
        uid: callerUid,
        skippedCount: skippedUsers.length,
        fn: "sendPushNotificationInternal",
      });

      return {
        success: true,
        successCount: 0,
        failureCount: 0,
        skippedCount: skippedUsers.length + dedupedUsers.length,
        message: "No tokens to send to",
      };
    }

    // Send via multicast
    const result = await sendMulticast({
      tokens,
      notification,
      notificationType,
    });

    // Cleanup invalid tokens
    if (result.failedTokens.length > 0) {
      await cleanupInvalidTokens(result.failedTokens);
    }

    logger.info("Push notifications sent", {
      traceId: actualTraceId,
      uid: callerUid,
      successCount: result.successCount,
      failureCount: result.failureCount,
      skippedCount: skippedUsers.length + dedupedUsers.length,
      dedupedCount: dedupedUsers.length,
      fn: "sendPushNotificationInternal",
    });

    if (result.successCount > 0 && resolvedDedupeKey) {
      await recordNotificationDedupe({
        traceId: actualTraceId,
        userIds: eligibleUsers,
        notificationType,
        dedupeKey: resolvedDedupeKey,
      });
    }

    return {
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      skippedCount: skippedUsers.length + dedupedUsers.length,
      message: `Sent to ${result.successCount}/${tokens.length} devices`,
    };
  } catch (error) {
    logger.error("Failed to send push notifications", error as Error, {
      traceId: actualTraceId,
      uid: callerUid,
      fn: "sendPushNotificationInternal",
    });

    throw error;
  }
}

/**
 * Send notification to user with specific notification type checking
 * This is a convenience wrapper that maintains backward compatibility
 *
 * @param userIds - Array of user IDs
 * @param notification - Notification data
 * @param notificationType - Type for preference checking
 * @returns Result
 */
export async function sendPushNotificationCompat(
  userIds: string[],
  notification: {
    title: string;
    body: string;
    data?: Record<string, any>;
    priority?: string;
    sound?: string;
    badge?: number;
    imageUrl?: string;
    clickAction?: string;
    color?: string;
    tag?: string;
  },
  notificationType: string,
  traceId?: string
): Promise<{
  success: boolean;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  message: string;
}> {
  return sendPushNotificationInternal({
    traceId,
    userIds,
    notification: {
      title: notification.title,
      body: notification.body,
      data: notification.data,
      priority: notification.priority === "high" ? "high" : "normal",
      sound: notification.sound,
      badge: notification.badge,
      imageUrl: notification.imageUrl,
      clickAction: notification.clickAction,
      color: notification.color,
      tag: notification.tag,
    },
    notificationType,
    requireAuth: false,
  });
}
