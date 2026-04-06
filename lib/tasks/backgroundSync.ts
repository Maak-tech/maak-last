/**
 * Background Sync Task
 *
 * Registered with expo-background-fetch so the OS can invoke it periodically
 * even when the app is not in the foreground. On iOS the system decides the
 * actual interval (minimum 15 minutes). On Android the task runs via
 * WorkManager with a similar minimum interval.
 *
 * What the task does:
 *   1. Flushes any queued offline operations (health data written while offline)
 *   2. Checks whether the local emergency cache is stale; if so it logs a
 *      warning — a full refresh requires auth and cannot be done here without
 *      the user's session, so the foreground sync path in AuthContext remains
 *      responsible for keeping the cache fresh.
 *
 * IMPORTANT: TaskManager.defineTask must be called at module level (not inside
 * a component or function) and this file must be imported at the app root so
 * the definition is registered before the OS invokes the task.
 */

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { offlineService } from "../services/offlineService";
import { getEmergencyCache } from "../services/emergencyCacheService";

export const BACKGROUND_SYNC_TASK = "NURALIX_BACKGROUND_SYNC";

// ── Task definition (module-level, required by TaskManager) ───────────────────

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    console.log("[BackgroundSync] Task invoked at", new Date().toISOString());

    // 1. Flush the offline operations queue
    const { success, failed } = await offlineService.syncAll();
    console.log(`[BackgroundSync] Offline queue flushed — success: ${success}, failed: ${failed}`);

    // 2. Check whether the emergency cache is stale (> 24 h old)
    // A full re-sync requires the user's auth session which is not available
    // in a background task, so we only log a warning here. The foreground
    // AuthContext sync will refresh it when the user next opens the app.
    const cache = await getEmergencyCache();
    if (cache) {
      const ageMs = Date.now() - new Date(cache.cachedAt).getTime();
      const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
      if (ageMs > STALE_THRESHOLD_MS) {
        console.log("[BackgroundSync] Emergency cache is stale — will refresh on next foreground session");
      }
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error("[BackgroundSync] Task failed:", err instanceof Error ? err.message : String(err));
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── Registration helpers ──────────────────────────────────────────────────────

/**
 * Register the background sync task with the OS scheduler.
 * Safe to call multiple times — skips registration if the task is already registered.
 */
export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();

    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.log("[BackgroundSync] Background fetch is not available on this device/OS setting");
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      console.log("[BackgroundSync] Task already registered — skipping");
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (iOS minimum enforced by the OS)
      stopOnTerminate: false,   // Keep running after the app is killed (Android)
      startOnBoot: false,       // No need to start on device boot for health sync
    });

    console.log("[BackgroundSync] Registered background sync task");
  } catch (err) {
    // Non-fatal: log and continue. The app works fine without background sync.
    console.error("[BackgroundSync] Failed to register task:", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Unregister the background sync task. Call this on sign-out so the OS stops
 * invoking the task when there is no authenticated session.
 */
export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      console.log("[BackgroundSync] Unregistered background sync task");
    }
  } catch (err) {
    console.error("[BackgroundSync] Failed to unregister task:", err instanceof Error ? err.message : String(err));
  }
}
