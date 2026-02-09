/**
 * Offline wrapper service that makes other services offline-first
 * This wrapper intercepts service calls and queues them when offline
 */

import { offlineService } from "./offlineService";

type ServiceMethod<T> = (...args: unknown[]) => Promise<T>;

/**
 * Wrap a service method to be offline-first
 */
export function makeOfflineFirst<T>(
  method: ServiceMethod<T>,
  collectionName: string,
  operationType: "create" | "update" | "delete"
): ServiceMethod<T> {
  return async (...args: unknown[]): Promise<T> => {
    const isOnline = offlineService.isDeviceOnline();

    if (isOnline) {
      try {
        // Try to execute online
        return await method(...args);
      } catch (error) {
        // If online but fails, queue for retry
        const data = (args[0] as Record<string, unknown> | undefined) ?? {};
        await offlineService.queueOperation({
          type: operationType,
          collection: collectionName,
          data,
        });
        throw error;
      }
    } else {
      // Offline - queue the operation
      const data = (args[0] as Record<string, unknown> | undefined) ?? {};
      const operationId = await offlineService.queueOperation({
        type: operationType,
        collection: collectionName,
        data,
      });

      // Return a mock result for offline operations
      // The actual ID will be generated when synced
      return {
        id: `offline_${operationId}`,
        ...data,
      } as T;
    }
  };
}

/**
 * Wrap a read method to use offline cache when offline
 */
export function makeOfflineRead<T>(
  method: ServiceMethod<T[]>,
  collectionName: Exclude<
    keyof import("./offlineService").OfflineData,
    "lastSync"
  >
): ServiceMethod<T[]> {
  return async (...args: unknown[]): Promise<T[]> => {
    const isOnline = offlineService.isDeviceOnline();

    if (isOnline) {
      try {
        const result = await method(...args);
        // Cache the result for offline use
        await offlineService.storeOfflineData(collectionName, result);
        return result;
      } catch (error) {
        // If online but fails, try offline cache
        const offlineData =
          await offlineService.getOfflineCollection<T>(collectionName);
        if (offlineData.length > 0) {
          return offlineData;
        }
        throw error;
      }
    } else {
      // Offline - use cached data
      return await offlineService.getOfflineCollection<T>(collectionName);
    }
  };
}
