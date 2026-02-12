import { Platform } from "react-native";
import type {
  BackgroundFallDetectionEvent,
  FallDetectionAvailability,
} from "../../modules/expo-fall-detection";
import {
  addFallDetectedListener,
  clearPendingEvents,
  getPendingEvents,
  isAvailable,
  isRunning,
  startBackgroundDetection,
  stopBackgroundDetection,
} from "../../modules/expo-fall-detection";

const safeCall = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

export const backgroundFallDetectionService = {
  async isAvailable(): Promise<FallDetectionAvailability> {
    if (Platform.OS === "web") {
      return { available: false, reason: "Web not supported" };
    }
    return safeCall(() => isAvailable(), {
      available: false,
      reason: "Native module unavailable",
    });
  },

  async start(): Promise<boolean> {
    if (Platform.OS === "web") {
      return false;
    }
    return safeCall(() => startBackgroundDetection(), false);
  },

  async stop(): Promise<boolean> {
    if (Platform.OS === "web") {
      return false;
    }
    return safeCall(() => stopBackgroundDetection(), false);
  },

  async isRunning(): Promise<boolean> {
    if (Platform.OS === "web") {
      return false;
    }
    return safeCall(() => isRunning(), false);
  },

  async getPendingEvents(): Promise<BackgroundFallDetectionEvent[]> {
    if (Platform.OS === "web") {
      return [];
    }
    return safeCall(() => getPendingEvents(), []);
  },

  async clearPendingEvents(): Promise<boolean> {
    if (Platform.OS === "web") {
      return false;
    }
    return safeCall(() => clearPendingEvents(), false);
  },

  addListener(
    listener: (event: BackgroundFallDetectionEvent) => void
  ): { remove: () => void } | null {
    if (Platform.OS === "web") {
      return null;
    }
    try {
      return addFallDetectedListener(listener);
    } catch {
      return null;
    }
  },
};
