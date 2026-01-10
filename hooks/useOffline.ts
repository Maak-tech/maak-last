import { useEffect, useState } from "react";
import { offlineService, type OfflineOperation } from "@/lib/services/offlineService";

export interface UseOfflineReturn {
  isOnline: boolean;
  queueLength: number;
  lastSync: Date | null;
  syncAll: () => Promise<{ success: number; failed: number }>;
  queueOperation: (
    operation: Omit<OfflineOperation, "id" | "timestamp" | "retries">
  ) => Promise<string>;
}

/**
 * Hook to manage offline functionality
 */
export function useOffline(): UseOfflineReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [queueLength, setQueueLength] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    // Check initial status
    checkStatus();

    // Subscribe to network changes
    const unsubscribe = offlineService.onNetworkStatusChange((online) => {
      setIsOnline(online);
      if (online) {
        checkStatus();
      }
    });

    // Poll status periodically
    const interval = setInterval(() => {
      checkStatus();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const checkStatus = async () => {
    const status = await offlineService.getSyncStatus();
    setQueueLength(status.queueLength);
    setIsOnline(status.isOnline);
    setLastSync(status.lastSync);
  };

  const syncAll = async () => {
    const result = await offlineService.syncAll();
    await checkStatus();
    return result;
  };

  const queueOperation = async (
    operation: Omit<OfflineOperation, "id" | "timestamp" | "retries">
  ) => {
    const id = await offlineService.queueOperation(operation);
    await checkStatus();
    return id;
  };

  return {
    isOnline,
    queueLength,
    lastSync,
    syncAll,
    queueOperation,
  };
}
