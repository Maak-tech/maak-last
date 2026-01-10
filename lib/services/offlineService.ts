import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Symptom,
  Medication,
  Mood,
  Allergy,
  VitalSign,
  LabResult,
} from "@/types";

const OFFLINE_QUEUE_KEY = "@maak_offline_queue";
const OFFLINE_DATA_KEY = "@maak_offline_data";
const SYNC_STATUS_KEY = "@maak_sync_status";

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
  private isOnline: boolean = true;
  private syncListeners: Array<(isOnline: boolean) => void> = [];
  private networkCheckInterval: NodeJS.Timeout | null = null;

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
      if (wasOnline !== this.isOnline) {
        this.syncListeners.forEach((listener) => listener(this.isOnline));
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Cleanup network listener
   */
  cleanup() {
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
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
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Add operation to offline queue
   */
  async queueOperation(operation: Omit<OfflineOperation, "id" | "timestamp" | "retries">): Promise<string> {
    const queue = await this.getOfflineQueue();
    const newOperation: OfflineOperation = {
      ...operation,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retries: 0,
    };

    queue.push(newOperation);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

    // If online, try to sync immediately
    if (this.isOnline) {
      this.syncOperation(newOperation);
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
      return queue.map((op: any) => ({
        ...op,
        timestamp: new Date(op.timestamp),
      }));
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

      await AsyncStorage.setItem(
        OFFLINE_DATA_KEY,
        JSON.stringify(offlineData)
      );
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
  async getOfflineCollection<T>(
    collection: keyof OfflineData
  ): Promise<T[]> {
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
        case "symptoms":
          const { symptomService } = await import("./symptomService");
          services.symptom = symptomService;
          break;
        case "medications":
          const { medicationService } = await import("./medicationService");
          services.medication = medicationService;
          break;
        case "moods":
          const { moodService } = await import("./moodService");
          services.mood = moodService;
          break;
        case "allergies":
          const { allergyService } = await import("./allergyService");
          services.allergy = allergyService;
          break;
        case "labResults":
          const { labResultService } = await import("./labResultService");
          services.labResult = labResultService;
          break;
        default:
          return false;
      }

      const service = Object.values(services)[0];
      if (!service) return false;

      // Execute operation
      switch (operation.type) {
        case "create":
          if (service.addSymptom || service.addMedication || service.addMood || service.addAllergy || service.addLabResult) {
            await service[`add${operation.collection.charAt(0).toUpperCase() + operation.collection.slice(1).slice(0, -1)}`](
              operation.data.userId,
              operation.data
            );
          }
          break;
        case "update":
          if (service.updateSymptom || service.updateMedication || service.updateMood || service.updateAllergy || service.updateLabResult) {
            await service[`update${operation.collection.charAt(0).toUpperCase() + operation.collection.slice(1).slice(0, -1)}`](
              operation.data.id,
              operation.data
            );
          }
          break;
        case "delete":
          if (service.deleteSymptom || service.deleteMedication || service.deleteMood || service.deleteAllergy || service.deleteLabResult) {
            await service[`delete${operation.collection.charAt(0).toUpperCase() + operation.collection.slice(1).slice(0, -1)}`](
              operation.data.id
            );
          }
          break;
      }

      // Remove from queue
      await this.removeOperationFromQueue(operation.id);
      return true;
    } catch (error) {
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
  private async updateOperationInQueue(operation: OfflineOperation): Promise<void> {
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

    const queue = await this.getOfflineQueue();
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
   * Mark data as synced
   */
  async markSynced(): Promise<void> {
    const offlineData = await this.getOfflineData();
    offlineData.lastSync = new Date();
    await AsyncStorage.setItem(
      OFFLINE_DATA_KEY,
      JSON.stringify(offlineData)
    );
  }
}

export const offlineService = new OfflineService();
