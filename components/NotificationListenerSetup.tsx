/**
 * Ensures notification listeners (including medication alarm) are active app-wide.
 * Must be mounted inside AuthProvider since useNotifications uses useAuth.
 */
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationListenerSetup() {
  useNotifications();
  return null;
}
