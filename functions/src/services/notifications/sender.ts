/**
 * FCM Message Sender
 * Wraps Firebase Cloud Messaging multicast send
 */

import * as admin from 'firebase-admin';
import { logger } from '../../observability/logger';
import type { NotificationPayload, NotificationType, MulticastResult } from './types';

/**
 * Send options for multicast
 */
export interface SendMulticastOptions {
  tokens: string[];
  notification: NotificationPayload;
  notificationType: NotificationType;
  traceId?: string;
}

/**
 * Send push notification to multiple tokens via FCM multicast
 * 
 * @param options - Send options
 * @returns Result with success/failure counts and failed tokens
 */
export async function sendMulticast(
  options: SendMulticastOptions
): Promise<MulticastResult> {
  const { tokens, notification, notificationType, traceId } = options;

  logger.debug('Sending FCM multicast', {
    traceId,
    tokenCount: tokens.length,
    notificationType,
    fn: 'sendMulticast',
  });

  try {
    // Build FCM message
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        ...(notification.data || {}),
        notificationType,
        timestamp: new Date().toISOString(),
        clickAction: notification.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: notification.priority === 'high' ? ('high' as const) : ('normal' as const),
        notification: {
          sound: notification.sound || 'default',
          priority: notification.priority === 'high' ? ('high' as const) : ('default' as const),
          channelId: notificationType,
          tag: notification.tag,
          color: notification.color || '#2563EB',
          icon: 'ic_notification',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: notification.sound || 'default',
            badge: notification.badge !== undefined ? notification.badge : 1,
            'mutable-content': 1,
            category: notificationType.toUpperCase(),
          },
        },
        headers: {
          'apns-priority': notification.priority === 'high' ? '10' : '5',
        },
      },
      tokens,
    };

    // Send via FCM
    const response = await admin.messaging().sendEachForMulticast(message);

    // Collect failed tokens
    const failedTokens: string[] = [];
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
    }

    logger.info('FCM multicast sent', {
      traceId,
      notificationType,
      successCount: response.successCount,
      failureCount: response.failureCount,
      fn: 'sendMulticast',
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens,
    };
  } catch (error) {
    logger.error('Failed to send FCM multicast', error as Error, {
      traceId,
      tokenCount: tokens.length,
      notificationType,
      fn: 'sendMulticast',
    });

    // Return all as failed
    return {
      successCount: 0,
      failureCount: tokens.length,
      failedTokens: tokens,
    };
  }
}
