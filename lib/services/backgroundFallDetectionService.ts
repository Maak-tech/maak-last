/**
 * Background fall detection service.
 * Uses the device accelerometer via expo-sensors to monitor for fall events
 * even when the app is in the foreground. Background monitoring relies on
 * a headless task registered at app startup.
 */

import { Platform } from "react-native";
import { Accelerometer } from "expo-sensors";

export type FallEvent = {
  timestamp: Date;
  confidence: number;       // 0–100
  peakAcceleration: number; // g-force
  duration: number;         // milliseconds
};

type FallListener = (event: FallEvent) => void;

const FALL_THRESHOLD_G = 2.5;          // free-fall detection threshold
const IMPACT_THRESHOLD_G = 4.0;        // impact detection threshold
const SAMPLE_INTERVAL_MS = 100;        // 10 Hz

class BackgroundFallDetectionService {
  private subscription: ReturnType<typeof Accelerometer.addListener> | null = null;
  private listeners: Set<FallListener> = new Set();
  private isRunning = false;

  private freeFallStart: number | null = null;
  private lastMagnitude = 0;

  start(): void {
    if (this.isRunning) return;
    if (Platform.OS === "web") return;

    try {
      Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
      this.subscription = Accelerometer.addListener(({ x, y, z }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        this.processSample(magnitude);
        this.lastMagnitude = magnitude;
      });
      this.isRunning = true;
    } catch {
      // Accelerometer not available on this device
    }
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.isRunning = false;
    this.freeFallStart = null;
  }

  addListener(listener: FallListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private processSample(magnitude: number): void {
    const now = Date.now();

    // Detect free-fall phase (acceleration near 0g)
    if (magnitude < 0.5 && !this.freeFallStart) {
      this.freeFallStart = now;
    } else if (magnitude > 0.5) {
      this.freeFallStart = null;
    }

    // Detect impact after free-fall
    if (
      this.freeFallStart !== null &&
      magnitude > IMPACT_THRESHOLD_G &&
      now - this.freeFallStart < 2000   // fall + impact within 2 seconds
    ) {
      const duration = now - this.freeFallStart;
      const peakG = Math.max(magnitude, this.lastMagnitude);
      const confidence = Math.min(100, Math.round((peakG / IMPACT_THRESHOLD_G) * 70));

      const event: FallEvent = {
        timestamp: new Date(),
        confidence,
        peakAcceleration: peakG,
        duration,
      };

      this.freeFallStart = null;
      this.notifyListeners(event);
    }
  }

  private notifyListeners(event: FallEvent): void {
    this.listeners.forEach((fn) => {
      try { fn(event); } catch { /* listener error — non-fatal */ }
    });
  }

  get running(): boolean { return this.isRunning; }
}

export const backgroundFallDetectionService = new BackgroundFallDetectionService();
