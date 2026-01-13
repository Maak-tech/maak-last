/**
 * Notification Type Definitions
 * Shared types for notification system
 */

/**
 * Notification type enum
 */
export type NotificationType =
  | 'fall'
  | 'medication'
  | 'symptom'
  | 'vital'
  | 'trend'
  | 'family'
  | 'general'
  | string; // Allow other types for extensibility

/**
 * Notification payload
 */
export interface NotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal';
  sound?: string;
  badge?: number;
  clickAction?: string;
  color?: string;
  tag?: string;
}

/**
 * Push notification result
 */
export interface PushNotificationResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  message: string;
}

/**
 * Multicast send result
 */
export interface MulticastResult {
  successCount: number;
  failureCount: number;
  failedTokens: string[];
}

/**
 * Internal send options
 */
export interface SendPushNotificationOptions {
  traceId?: string;
  userIds: string[];
  notification: NotificationPayload;
  notificationType: NotificationType;
  requireAuth?: boolean;
  callerUid?: string;
}
