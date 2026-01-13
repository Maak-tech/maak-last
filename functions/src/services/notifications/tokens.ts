/**
 * FCM Token Management
 * Handles retrieval of Firebase Cloud Messaging tokens for users
 * Supports BOTH legacy fcmToken and new fcmTokens map
 */

import * as admin from 'firebase-admin';
import { logger } from '../../observability/logger';

/**
 * Get FCM tokens for a user
 * Supports BOTH:
 * 1. New format: fcmTokens map with device IDs
 * 2. Legacy format: fcmToken (string or array)
 * 
 * @param userId - The user ID to get tokens for
 * @param traceId - Optional correlation ID for logging
 * @returns Array of FCM tokens
 */
export async function getUserTokens(
  userId: string,
  traceId?: string
): Promise<string[]> {
  logger.debug('Getting FCM tokens for user', {
    traceId,
    uid: userId,
    fn: 'getUserTokens',
  });

  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      logger.debug('User not found', {
        traceId,
        uid: userId,
        fn: 'getUserTokens',
      });
      return [];
    }

    const tokens: string[] = [];

    // Check new format first: fcmTokens map with device IDs
    if (userData.fcmTokens && typeof userData.fcmTokens === 'object') {
      for (const deviceId in userData.fcmTokens) {
        const deviceToken = userData.fcmTokens[deviceId];
        if (deviceToken && typeof deviceToken === 'object' && deviceToken.token) {
          tokens.push(deviceToken.token);
        } else if (typeof deviceToken === 'string') {
          // Handle simplified format
          tokens.push(deviceToken);
        }
      }
    }

    // Fallback to legacy format: fcmToken (string or array)
    if (userData.fcmToken) {
      if (Array.isArray(userData.fcmToken)) {
        tokens.push(...userData.fcmToken);
      } else if (typeof userData.fcmToken === 'string') {
        tokens.push(userData.fcmToken);
      }
    }

    // Remove duplicates
    const uniqueTokens = Array.from(new Set(tokens));

    logger.debug('FCM tokens retrieved', {
      traceId,
      uid: userId,
      tokenCount: uniqueTokens.length,
      fn: 'getUserTokens',
    });

    return uniqueTokens;
  } catch (error) {
    logger.error('Failed to get FCM tokens', error as Error, {
      traceId,
      uid: userId,
      fn: 'getUserTokens',
    });
    return [];
  }
}
