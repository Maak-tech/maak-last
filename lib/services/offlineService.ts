import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Allergy,
  LabResult,
  Medication,
  Mood,
  Symptom,
  VitalSign,
} from "@/types";

const OFFLINE_QUEUE_KEY = "@maak_offline_queue";
const OFFLINE_DATA_KEY = "@maak_offline_data";
const SYNC_STATUS_KEY = "@maak_sync_status";
const NETWORK_CHECK_INTERVAL_MS = 30_000;
const AUTO_SYNC_INTERVAL_MS = 60_000;

export interface OfflineOperation {
  id: string;
  type: "create" | "update" | "delete";
  collection: string;
  data: any;
  timestamp: Date;
  retries: number;
}

export interface OfflineData {
  symptoms: Symptom[];
  medications: Medication[];
  moods: Mood[];
  allergies: Allergy[];
  vitals: VitalSign[];
  labResults: LabResult[];
  lastSync: Date | null;
}

class OfflineService {
  private isOnline = true;
  private syncListeners: Array<(isOnline: boolean) => void> = [];
  private networkCheckInterval: ReturnType<typeof setInterval> | null = null;
  private autoSyncInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  constructor() {
    this.initializeNetworkListener();
  }

  /**
   * Check network connectivity
   */
  private async checkNetworkStatus(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch("https://www.google.com", {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Initialize network status listener
   */
  private async initializeNetworkListener() {
    // Check initial network status
    this.isOnline = await this.checkNetworkStatus();

    // Poll network status periodically
    this.networkCheckInterval = setInterval(async () => {
      const wasOnline = this.isOnline;
      this.isOnline = await this.checkNetworkStatus();

      if (!wasOnline && this.isOnline) {
        // Just came online, trigger sync
        this.syncAll();
      }

      // Notify listeners if status changed
      if (
        wasOnline !== this.isOnline &&
        this.syncListeners &&
        Array.isArray(this.syncListeners)
      ) {
        this.syncListeners.forEach((listener) => {
          try {
            listener(this.isOnline);
          } catch (error) {
            // Error in sync listener
          }
        });
      }
    }, NETWORK_CHECK_INTERVAL_MS); // Check every 30 seconds

    // Start automatic sync interval
    this.startAutoSync();
  }

  /**
   * Start automatic sync interval
   */
  private startAutoSync() {
    // Clear existing interval if any
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }

    // Auto-sync every 15 seconds when online and there are pending items
    this.autoSyncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        const queue = await this.getOfflineQueue();
        if (queue.length > 0) {
          this.syncAll();
        }
      }
    }, AUTO_SYNC_INTERVAL_MS); // Check every 60 seconds
  }

  /**
   * Cleanup network listener
   */
  cleanup() {
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
    // Clear listeners to prevent memory leaks
    if (this.syncListeners) {
      this.syncListeners = [];
    }
  }

  /**
   * Check if device is online
   */
  isDeviceOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Subscribe to network status changes
   */
  onNetworkStatusChange(listener: (isOnline: boolean) => void): () => void {
    if (!this.syncListeners) {
      this.syncListeners = [];
    }
    this.syncListeners.push(listener);
    return () => {
      if (this.syncListeners && Array.isArray(this.syncListeners)) {
        this.syncListeners = this.syncListeners.filter((l) => l !== listener);
      }
    };
  }

  /**
   * Add operation to offline queue
   */
  async queueOperation(
    operation: Omit<OfflineOperation, "id" | "timestamp" | "retries">
  ): Promise<string> {
    const queue = await this.getOfflineQueue();
    const newOperation: OfflineOperation = {
      ...operation,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retries: 0,
    };

    queue.push(newOperation);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

    // If online, try to sync immediately (don't await to avoid blocking)
    if (this.isOnline && !this.isSyncing) {
      // Use setTimeout to avoid blocking the current operation
      setTimeout(() => {
        this.syncOperation(newOperation).catch(() => {
          // Error syncing operation immediately
        });
      }, 100);
    }

    return newOperation.id;
  }

  /**
   * Get offline queue
   */
  async getOfflineQueue(): Promise<OfflineOperation[]> {
    try {
      const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!queueJson) return [];

      const queue = JSON.parse(queueJson);
      return queue.map((op: any) => {
        // Restore Date objects from strings
        const restoredOp = {
          ...op,
          timestamp: op.timestamp ? new Date(op.timestamp) : new Date(),
        };

        // Also restore Date objects in operation.data if they exist
        if (restoredOp.data) {
          if (
            restoredOp.data.timestamp &&
            typeof restoredOp.data.timestamp === "string"
          ) {
            restoredOp.data.timestamp = new Date(restoredOp.data.timestamp);
          }
          if (
            restoredOp.data.startDate &&
            typeof restoredOp.data.startDate === "string"
          ) {
            restoredOp.data.startDate = new Date(restoredOp.data.startDate);
          }
          if (
            restoredOp.data.endDate &&
            typeof restoredOp.data.endDate === "string"
          ) {
            restoredOp.data.endDate = new Date(restoredOp.data.endDate);
          }
          if (
            restoredOp.data.date &&
            typeof restoredOp.data.date === "string"
          ) {
            restoredOp.data.date = new Date(restoredOp.data.date);
          }
        }

        return restoredOp;
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Store data locally for offline access
   */
  async storeOfflineData<T>(
    collection: keyof OfflineData,
    data: T[]
  ): Promise<void> {
    try {
      const offlineData = await this.getOfflineData();
      offlineData[collection] = data as any;
      offlineData.lastSync = new Date();

      await AsyncStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(offlineData));
    } catch (error) {
      // Handle error silently
    }
  }

  /**
   * Get offline data
   */
  async getOfflineData(): Promise<OfflineData> {
    try {
      const dataJson = await AsyncStorage.getItem(OFFLINE_DATA_KEY);
      if (!dataJson) {
        return {
          symptoms: [],
          medications: [],
          moods: [],
          allergies: [],
          vitals: [],
          labResults: [],
          lastSync: null,
        };
      }

      const data = JSON.parse(dataJson);
      return {
        ...data,
        lastSync: data.lastSync ? new Date(data.lastSync) : null,
      };
    } catch (error) {
      return {
        symptoms: [],
        medications: [],
        moods: [],
        allergies: [],
        vitals: [],
        labResults: [],
        lastSync: null,
      };
    }
  }

  /**
   * Get data from specific collection (offline-first)
   */
  async getOfflineCollection<T>(collection: keyof OfflineData): Promise<T[]> {
    const offlineData = await this.getOfflineData();
    return (offlineData[collection] || []) as T[];
  }

  /**
   * Sync a single operation
   */
  private async syncOperation(operation: OfflineOperation): Promise<boolean> {
    if (!this.isOnline) return false;

    try {
      // Import services dynamically to avoid circular dependencies
      const services: Record<string, any> = {};

      switch (operation.collection) {
        case "symptoms": {
          const { symptomService } = await import("./symptomService");
          services.symptom = symptomService;
          break;
        }
        case "medications": {
          const { medicationService } = await import("./medicationService");
          services.medication = medicationService;
          break;
        }
        case "moods": {
          const { moodService } = await import("./moodService");
          services.mood = moodService;
          break;
        }
        case "allergies": {
          const { allergyService } = await import("./allergyService");
          services.allergy = allergyService;
          break;
        }
        case "labResults": {
          const { labResultService } = await import("./labResultService");
          services.labResult = labResultService;
          break;
        }
        default:
          return false;
      }

      const service = Object.values(services)[0];
      if (!service) {
        return false;
      }

      // Execute operation directly to Firebase to bypass service layer offline checks
      let operationSucceeded = false;
      switch (operation.type) {
        case "create": {
          // Prepare data for Firebase
          const dataToSave: any = { ...operation.data };

          // Helper function to safely convert to Timestamp
          const toTimestamp = (value: any): Timestamp | any => {
            if (!value) return value;
            if (value instanceof Date) {
              return Timestamp.fromDate(value);
            }
            if (typeof value === "string") {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                return Timestamp.fromDate(date);
              }
            }
            // If it's already a Timestamp-like object, try to convert
            if (
              value &&
              typeof value === "object" &&
              "seconds" in value &&
              "nanoseconds" in value
            ) {
              return Timestamp.fromMillis(
                value.seconds * 1000 + (value.nanoseconds || 0) / 1_000_000
              );
            }
            return value;
          };

          // Convert Date objects to Timestamps
          if (dataToSave.timestamp) {
            dataToSave.timestamp = toTimestamp(dataToSave.timestamp);
          }
          if (dataToSave.startDate) {
            dataToSave.startDate = toTimestamp(dataToSave.startDate);
          }
          if (dataToSave.endDate) {
            dataToSave.endDate = toTimestamp(dataToSave.endDate);
          }
          if (dataToSave.date) {
            dataToSave.date = toTimestamp(dataToSave.date);
          }

          // Filter out undefined values and null values that might cause issues
          const cleanedData = Object.fromEntries(
            Object.entries(dataToSave).filter(
              ([_, value]) => value !== undefined && value !== null
            )
          );

          // Validate required fields for symptoms
          if (operation.collection === "symptoms") {
            if (!cleanedData.userId) {
              throw new Error("Missing userId in symptom data");
            }
            if (!cleanedData.timestamp) {
              throw new Error("Missing timestamp in symptom data");
            }
            if (!cleanedData.type) {
              throw new Error("Missing type in symptom data");
            }
          }

          // Write directly to Firebase
          const docRef = await addDoc(
            collection(db, operation.collection),
            cleanedData
          );

          // Add to health timeline for symptoms
          if (operation.collection === "symptoms" && operation.data.userId) {
            try {
              await healthTimelineService.addEvent({
                userId: operation.data.userId,
                eventType: "symptom_logged",
                title: `Symptom logged: ${operation.data.type || "Unknown"}`,
                description:
                  operation.data.description ||
                  `Severity: ${operation.data.severity || "N/A"}/5`,
                timestamp: operation.data.timestamp || new Date(),
                severity:
                  operation.data.severity >= 4
                    ? "error"
                    : operation.data.severity >= 3
                      ? "warn"
                      : "info",
                icon: "thermometer",
                metadata: {
                  symptomId: docRef.id,
                  symptomType: operation.data.type,
                  severity: operation.data.severity,
                },
                relatedEntityId: docRef.id,
                relatedEntityType: "symptom",
                actorType: "user",
              });
            } catch (timelineError) {
              // Don't fail sync if timeline update fails
            }
          }

          operationSucceeded = true;
          break;
        }
        case "update": {
          if (!operation.data.id) {
            return false;
          }

          // Prepare data for Firebase
          const updates: any = { ...operation.data };
          delete updates.id; // Remove id from updates

          // Convert Date objects to Timestamps
          if (updates.timestamp && updates.timestamp instanceof Date) {
            updates.timestamp = Timestamp.fromDate(updates.timestamp);
          }
          if (updates.startDate && updates.startDate instanceof Date) {
            updates.startDate = Timestamp.fromDate(updates.startDate);
          }
          if (updates.endDate && updates.endDate instanceof Date) {
            updates.endDate = Timestamp.fromDate(updates.endDate);
          }
          if (updates.date && updates.date instanceof Date) {
            updates.date = Timestamp.fromDate(updates.date);
          }

          // Filter out undefined values
          const cleanedUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, value]) => value !== undefined)
          );

          // Update directly in Firebase
          await updateDoc(
            doc(db, operation.collection, operation.data.id),
            cleanedUpdates
          );

          operationSucceeded = true;
          break;
        }
        case "delete": {
          if (!operation.data.id) {
            return false;
          }

          // For medications, mark as inactive instead of deleting
          if (operation.collection === "medications") {
            await updateDoc(doc(db, operation.collection, operation.data.id), {
              isActive: false,
            });
          } else {
            // Delete directly from Firebase
            await deleteDoc(doc(db, operation.collection, operation.data.id));
          }

          operationSucceeded = true;
          break;
        }
        default:
          return false;
      }

      // Only remove from queue if operation succeeded
      if (operationSucceeded) {
        await this.removeOperationFromQueue(operation.id);
        return true;
      }

      return false;
    } catch (error) {
      // Log error for debugging with full details
      const errorDetails: any = {
        operationId: operation.id,
        retries: operation.retries,
        operationType: operation.type,
        collection: operation.collection,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      };

      // Add Firebase error code if available
      if (error && typeof error === "object" && "code" in error) {
        errorDetails.firebaseErrorCode = (error as any).code;
      }

      // Log operation data (safe stringify)
      try {
        const dataPreview = { ...operation.data };
        // Remove potentially large fields for logging
        if (dataPreview.description)
          dataPreview.description = dataPreview.description.substring(0, 50);
        errorDetails.operationDataPreview = dataPreview;
      } catch (e) {
        errorDetails.operationDataError = "Could not serialize operation data";
      }

      // Sync operation failed

      // Increment retries
      operation.retries++;
      if (operation.retries < 5) {
        await this.updateOperationInQueue(operation);
      } else {
        // Too many retries, remove from queue
        await this.removeOperationFromQueue(operation.id);
      }
      return false;
    }
  }

  /**
   * Remove operation from queue
   */
  private async removeOperationFromQueue(operationId: string): Promise<void> {
    const queue = await this.getOfflineQueue();
    const filtered = queue.filter((op) => op.id !== operationId);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  }

  /**
   * Update operation in queue
   */
  private async updateOperationInQueue(
    operation: OfflineOperation
  ): Promise<void> {
    const queue = await this.getOfflineQueue();
    const index = queue.findIndex((op) => op.id === operation.id);
    if (index !== -1) {
      queue[index] = operation;
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  }

  /**
   * Sync all queued operations
   */
  async syncAll(): Promise<{ success: number; failed: number }> {
    if (!this.isOnline) {
      return { success: 0, failed: 0 };
    }

    // Prevent concurrent syncs
    if (this.isSyncing) {
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;

    try {
      const queue = await this.getOfflineQueue();
      if (queue.length === 0) {
        return { success: 0, failed: 0 };
      }

      let success = 0;
      let failed = 0;

      for (const operation of queue) {
        const result = await this.syncOperation(operation);
        if (result) {
          success++;
        } else {
          failed++;
        }
      }

      return { success, failed };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Clear offline queue
   */
  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    isOnline: boolean;
    queueLength: number;
    lastSync: Date | null;
  }> {
    const queue = await this.getOfflineQueue();
    const offlineData = await this.getOfflineData();

    return {
      isOnline: this.isOnline,
      queueLength: queue.length,
      lastSync: offlineData.lastSync,
    };
  }

  /**
   * Get detailed queue information for debugging
   */
  async getQueueDetails(): Promise<OfflineOperation[]> {
    return this.getOfflineQueue();
  }

  /**
   * Mark data as synced
   */
  async markSynced(): Promise<void> {
    const offlineData = await this.getOfflineData();
    offlineData.lastSync = new Date();
    await AsyncStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(offlineData));
  }
}

export const offlineService = new OfflineService();
