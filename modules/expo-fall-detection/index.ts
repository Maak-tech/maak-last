import { EventEmitter } from "expo-modules-core";
import ExpoFallDetectionModule from "./ExpoFallDetectionModule";

export type FallDetectionAvailability = {
  available: boolean;
  reason?: string;
};

export type BackgroundFallDetectionEvent = {
  timestamp: number;
  severity?: "low" | "medium" | "high";
  source?: "background" | "foreground";
};

export type StartFallDetectionOptions = {
  sensitivity?: number;
  minConfidence?: number;
};

const emitter = new EventEmitter(ExpoFallDetectionModule as any);

export function isAvailable(): Promise<FallDetectionAvailability> {
  if (typeof ExpoFallDetectionModule.isAvailable !== "function") {
    return Promise.resolve({
      available: false,
      reason: "Native module not available",
    });
  }
  return ExpoFallDetectionModule.isAvailable();
}

export function startBackgroundDetection(
  options?: StartFallDetectionOptions
): Promise<boolean> {
  if (typeof ExpoFallDetectionModule.start !== "function") {
    return Promise.resolve(false);
  }
  return ExpoFallDetectionModule.start(options ?? {});
}

export function stopBackgroundDetection(): Promise<boolean> {
  if (typeof ExpoFallDetectionModule.stop !== "function") {
    return Promise.resolve(false);
  }
  return ExpoFallDetectionModule.stop();
}

export function isRunning(): Promise<boolean> {
  if (typeof ExpoFallDetectionModule.isRunning !== "function") {
    return Promise.resolve(false);
  }
  return ExpoFallDetectionModule.isRunning();
}

export function getPendingEvents(): Promise<BackgroundFallDetectionEvent[]> {
  if (typeof ExpoFallDetectionModule.getPendingEvents !== "function") {
    return Promise.resolve([]);
  }
  return ExpoFallDetectionModule.getPendingEvents();
}

export function clearPendingEvents(): Promise<boolean> {
  if (typeof ExpoFallDetectionModule.clearPendingEvents !== "function") {
    return Promise.resolve(false);
  }
  return ExpoFallDetectionModule.clearPendingEvents();
}

export function addFallDetectedListener(
  listener: (event: BackgroundFallDetectionEvent) => void
) {
  return (emitter as any).addListener("onFallDetected", listener);
}

export default {
  isAvailable,
  startBackgroundDetection,
  stopBackgroundDetection,
  isRunning,
  getPendingEvents,
  clearPendingEvents,
  addFallDetectedListener,
};
