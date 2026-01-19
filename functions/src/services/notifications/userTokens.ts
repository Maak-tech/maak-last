/**
 * User FCM Token Management
 * Handles retrieval of Firebase Cloud Messaging tokens for users
 */

import * as admin from "firebase-admin";
import { logger } from "../../observability/logger";

/**
 * Get FCM tokens for a user
 * Supports both legacy (single token) and new (array of tokens) formats
 *
 * @param userId - The user ID to get tokens for
 * @param traceId - Optional correlation ID for logging
 * @returns Array of FCM tokens
 */
export async function getUserTokens(
  userId: string,
  traceId?: string
): Promise<string[]> {
  logger.debug("Getting FCM tokens for user", {
    traceId,
    uid: userId,
    fn: "getUserTokens",
  });

  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.fcmToken) {
      logger.debug("No FCM token found for user", {
        traceId,
        uid: userId,
        fn: "getUserTokens",
      });
      return [];
    }

    // Support both single token and array of tokens
    const tokens = Array.isArray(userData.fcmToken)
      ? userData.fcmToken
      : [userData.fcmToken];

    logger.debug("FCM tokens retrieved", {
      traceId,
      uid: userId,
      tokenCount: tokens.length,
      fn: "getUserTokens",
    });

    return tokens;
  } catch (error) {
    logger.error("Failed to get FCM tokens", error as Error, {
      traceId,
      uid: userId,
      fn: "getUserTokens",
    });
    return [];
  }
}
