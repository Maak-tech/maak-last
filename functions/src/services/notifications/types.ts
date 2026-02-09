/**
 * Notification Type Definitions
 * Shared types for notification system
 */

/**
 * Notification type enum
 */
export type NotificationType =
  | "fall"
  | "medication"
  | "symptom"
  | "vital"
  | "trend"
  | "family"
  | "general"
  | string; // Allow other types for extensibility

/**
 * Notification payload
 */
export type NotificationPayload = {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
  priority?: "high" | "normal";
  sound?: string;
  badge?: number;
  clickAction?: string;
  color?: string;
  tag?: string;
};

/**
 * Push notification result
 */
export type PushNotificationResult = {
  success: boolean;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  message: string;
};

/**
 * Multicast send result
 */
export type MulticastResult = {
  successCount: number;
  failureCount: number;
  failedTokens: string[];
};

/**
 * Internal send options
 */
export type SendPushNotificationOptions = {
  traceId?: string;
  userIds: string[];
  notification: NotificationPayload;
  notificationType: NotificationType;
  requireAuth?: boolean;
  callerUid?: string;
};
