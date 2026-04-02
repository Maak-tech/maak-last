/**
 * PPG Pixel Extractor — extracts photoplethysmography signals from
 * camera frames for camera-based heart rate and SpO2 estimation.
 *
 * Used by PPGVitalMonitorVisionCamera to process frames from the
 * Vision Camera API in real time.
 */

export interface PPGFrameSample {
  /** Average red channel value (0–255) */
  redAverage: number;
  /** Average green channel value (0–255) */
  greenAverage: number;
  /** Average blue channel value (0–255) */
  blueAverage: number;
  /** Timestamp of this frame in ms */
  timestamp: number;
  /** Estimated signal quality for this frame (0–1) */
  quality: number;
}

export interface SignalQualityMetrics {
  /** Overall signal quality score 0–1 */
  score: number;
  /** Whether the signal is stable enough for measurement */
  isStable: boolean;
  /** Whether a finger is detected on the camera */
  fingerDetected: boolean;
  /** Reason for low quality if score < 0.5 */
  issue?: "no_finger" | "motion" | "low_light" | "overexposed" | "none";
}

/**
 * Extract the average red channel value from a raw camera frame.
 * Expects the frame pixel data as a Uint8Array in RGBA format.
 *
 * @param pixelData - Raw RGBA pixel data from the camera frame
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @param roiX - Region of interest X offset (default: center third)
 * @param roiY - Region of interest Y offset (default: center third)
 * @param roiWidth - Region of interest width (default: center third of frame)
 * @param roiHeight - Region of interest height (default: center third of frame)
 */
export function extractRedChannelAverage(
  pixelData: Uint8Array,
  width: number,
  height: number,
  roiX?: number,
  roiY?: number,
  roiWidth?: number,
  roiHeight?: number
): number {
  // Default to the center 40% of the frame (where the finger typically sits)
  const startX = roiX ?? Math.floor(width * 0.3);
  const startY = roiY ?? Math.floor(height * 0.3);
  const endX = startX + (roiWidth ?? Math.floor(width * 0.4));
  const endY = startY + (roiHeight ?? Math.floor(height * 0.4));

  let redSum = 0;
  let pixelCount = 0;

  for (let y = startY; y < endY && y < height; y++) {
    for (let x = startX; x < endX && x < width; x++) {
      const index = (y * width + x) * 4; // RGBA stride = 4 bytes
      redSum += pixelData[index]; // R channel
      pixelCount++;
    }
  }

  return pixelCount > 0 ? redSum / pixelCount : 0;
}

/**
 * Calculate real-time signal quality metrics from a sliding window of samples.
 *
 * Analyzes the recent PPG samples to determine:
 * - Whether a finger is detected (high red channel saturation)
 * - Whether there's motion artifact (high variance in a short window)
 * - Whether the signal amplitude is sufficient for reliable measurement
 *
 * @param recentSamples - Last N samples (typically 30–60 at 30fps = 1–2 seconds)
 */
export function calculateRealTimeSignalQuality(
  recentSamples: PPGFrameSample[]
): SignalQualityMetrics {
  if (recentSamples.length < 5) {
    return { score: 0, isStable: false, fingerDetected: false, issue: "no_finger" };
  }

  const redValues = recentSamples.map((s) => s.redAverage);
  const mean = redValues.reduce((a, b) => a + b, 0) / redValues.length;

  // Finger detection: red channel mean > 100 (finger blocks light, raising red)
  const fingerDetected = mean > 100;
  if (!fingerDetected) {
    return { score: 0, isStable: false, fingerDetected: false, issue: "no_finger" };
  }

  // Overexposure check: if mean is near 255, saturated
  if (mean > 245) {
    return { score: 0.1, isStable: false, fingerDetected: true, issue: "overexposed" };
  }

  // Motion artifact: compute variance over the window
  const variance =
    redValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / redValues.length;
  const stdDev = Math.sqrt(variance);

  // High std dev relative to mean suggests motion
  const motionRatio = stdDev / Math.max(mean, 1);
  if (motionRatio > 0.15) {
    return {
      score: Math.max(0.1, 0.5 - motionRatio),
      isStable: false,
      fingerDetected: true,
      issue: "motion",
    };
  }

  // Amplitude check: the AC component (peak-to-peak) should be > 2 counts
  const min = Math.min(...redValues);
  const max = Math.max(...redValues);
  const amplitude = max - min;
  if (amplitude < 2) {
    return { score: 0.3, isStable: false, fingerDetected: true, issue: "low_light" };
  }

  // Good signal: score scales with amplitude and inverse motion ratio
  const score = Math.min(1, (amplitude / 20) * (1 - motionRatio * 2));

  return {
    score: Math.max(0.5, score),
    isStable: score > 0.6,
    fingerDetected: true,
    issue: "none",
  };
}
