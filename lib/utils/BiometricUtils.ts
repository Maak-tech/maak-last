/**
 * Biometric signal processing utilities for PPG (photoplethysmography).
 * Used by PPGVitalMonitor to compute heart rate, SpO2, and HRV from camera frames.
 */

export interface PPGResult {
  heartRate: number | null;       // beats per minute
  spo2: number | null;            // blood oxygen saturation (%)
  hrv: number | null;             // heart rate variability (RMSSD ms)
  confidence: number;             // 0–100, signal quality score
  signalQuality: "poor" | "fair" | "good" | "excellent";
  processingTimeMs: number;
  rawPeakIntervals: number[];     // RR intervals in ms
}

export interface PPGFrame {
  r: number[];   // red channel values
  g: number[];   // green channel values
  b: number[];   // blue channel values
  timestamp: number;
}

/**
 * Processes a batch of PPG frames and returns biometric estimates.
 * In production this calls the ml-service; here it provides a client-side
 * approximation using peak detection on the red channel.
 */
export async function processPPGSignalEnhanced(
  frames: PPGFrame[],
  sampleRateHz = 30
): Promise<PPGResult> {
  const start = Date.now();

  if (frames.length < sampleRateHz * 5) {
    // Need at least 5 seconds of data
    return {
      heartRate: null,
      spo2: null,
      hrv: null,
      confidence: 0,
      signalQuality: "poor",
      processingTimeMs: Date.now() - start,
      rawPeakIntervals: [],
    };
  }

  try {
    // Extract mean red channel signal
    const signal = frames.map((f) => f.r.reduce((a, b) => a + b, 0) / f.r.length);

    // Detrend signal (remove DC component)
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    const detrended = signal.map((v) => v - mean);

    // Detect peaks (simple threshold-based)
    const peaks: number[] = [];
    const threshold = Math.max(...detrended) * 0.5;
    for (let i = 1; i < detrended.length - 1; i++) {
      if (detrended[i] > threshold && detrended[i] > detrended[i - 1] && detrended[i] > detrended[i + 1]) {
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > sampleRateHz * 0.4) {
          peaks.push(i);
        }
      }
    }

    if (peaks.length < 3) {
      return {
        heartRate: null,
        spo2: null,
        hrv: null,
        confidence: 20,
        signalQuality: "poor",
        processingTimeMs: Date.now() - start,
        rawPeakIntervals: [],
      };
    }

    // Compute RR intervals
    const rrIntervals = [];
    for (let i = 1; i < peaks.length; i++) {
      rrIntervals.push(((peaks[i] - peaks[i - 1]) / sampleRateHz) * 1000);
    }

    // Heart rate from mean RR
    const meanRR = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
    const heartRate = Math.round(60_000 / meanRR);

    // HRV (RMSSD)
    let sumSq = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      sumSq += (rrIntervals[i] - rrIntervals[i - 1]) ** 2;
    }
    const hrv = Math.round(Math.sqrt(sumSq / (rrIntervals.length - 1)));

    // SpO2 estimate (simplified AC/DC ratio)
    const acR = Math.max(...detrended) - Math.min(...detrended);
    const dcR = mean;
    const spo2Raw = dcR > 0 ? 100 - 5 * (acR / dcR) : null;
    const spo2 = spo2Raw ? Math.min(100, Math.max(85, Math.round(spo2Raw))) : null;

    const plausible = heartRate >= 40 && heartRate <= 200;
    const confidence = plausible ? Math.min(90, peaks.length * 8) : 20;
    const signalQuality =
      confidence >= 75 ? "excellent" : confidence >= 55 ? "good" : confidence >= 35 ? "fair" : "poor";

    return {
      heartRate: plausible ? heartRate : null,
      spo2,
      hrv,
      confidence,
      signalQuality,
      processingTimeMs: Date.now() - start,
      rawPeakIntervals: rrIntervals,
    };
  } catch {
    return {
      heartRate: null,
      spo2: null,
      hrv: null,
      confidence: 0,
      signalQuality: "poor",
      processingTimeMs: Date.now() - start,
      rawPeakIntervals: [],
    };
  }
}
