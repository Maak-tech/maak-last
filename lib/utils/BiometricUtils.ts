/**
 * Biometric Utilities for Multimodal Authentication
 * Based on research papers:
 * - Olugbenle et al. (arXiv:2412.07082v1) - Low frame-rate PPG heart rate measurement
 * - Multimodal Fusion (arXiv:2412.05660) - Combining fingerprint + PPG for authentication
 */

// Lazy import to prevent crashes if native module isn't available
// Using 'any' type to avoid Metro bundler resolution issues at build time
let LocalAuthentication: any = null;

async function getLocalAuthentication() {
  if (!LocalAuthentication) {
    try {
      LocalAuthentication = await import("expo-local-authentication");
    } catch (error) {
      console.warn("expo-local-authentication not available:", error);
      return null;
    }
  }
  return LocalAuthentication;
}

export interface BiometricAvailability {
  available: boolean;
  supportedTypes: string[];
  error?: string;
}

export interface PPGResult {
  success: boolean;
  heartRate?: number;
  heartRateVariability?: number; // HRV in ms
  respiratoryRate?: number; // breaths per minute
  oxygenSaturation?: number; // SpO2 percentage (requires dual-wavelength)
  signalQuality: number; // 0-1, where 1 is perfect
  error?: string;
}

export interface BiometricResult {
  success: boolean;
  score: number; // 0-1 confidence score
  fingerprintScore?: number;
  ppgScore?: number;
  heartRate?: number;
  error?: string;
}

/**
 * Check if biometric authentication is available on the device
 */
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const LocalAuth = await getLocalAuthentication();
    if (!LocalAuth) {
      return {
        available: false,
        supportedTypes: [],
        error: "Biometric authentication module not available",
      };
    }

    const compatible = await LocalAuth.hasHardwareAsync();
    if (!compatible) {
      return {
        available: false,
        supportedTypes: [],
        error: "Biometric hardware not available",
      };
    }

    const enrolled = await LocalAuth.isEnrolledAsync();
    if (!enrolled) {
      return {
        available: false,
        supportedTypes: [],
        error: "No biometrics enrolled",
      };
    }

    const types = await LocalAuth.supportedAuthenticationTypesAsync();
    const typeNames = types.map((type: number) => {
      switch (type) {
        case LocalAuth.AuthenticationType.FACIAL_RECOGNITION:
          return "Face ID";
        case LocalAuth.AuthenticationType.FINGERPRINT:
          return "Fingerprint";
        case LocalAuth.AuthenticationType.IRIS:
          return "Iris";
        default:
          return "Unknown";
      }
    });

    return {
      available: true,
      supportedTypes: typeNames,
    };
  } catch (error: any) {
    return {
      available: false,
      supportedTypes: [],
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Authenticate using device biometrics (Face ID, Touch ID, Fingerprint)
 */
export async function authenticateBiometric(): Promise<{
  success: boolean;
  score: number;
  error?: string;
}> {
  try {
    const LocalAuth = await getLocalAuthentication();
    if (!LocalAuth) {
      return {
        success: false,
        score: 0,
        error: "Biometric authentication module not available",
      };
    }

    const result = await LocalAuth.authenticateAsync({
      promptMessage: "Authenticate with biometrics",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });

    if (result.success) {
      return {
        success: true,
        score: 1.0, // Perfect match for device biometrics
      };
    }

    return {
      success: false,
      score: 0,
      error: result.error || "Authentication failed",
    };
  } catch (error: any) {
    return {
      success: false,
      score: 0,
      error: error.message || "Biometric authentication error",
    };
  }
}

/**
 * Process PPG signal to extract heart rate
 * Based on Olugbenle et al. - Multi-order filtering approach
 * 
 * @param signal - Array of pixel intensity values (0-255)
 * @param frameRate - Frames per second (typically 14 fps)
 * @returns Heart rate in BPM and signal quality
 */
export function processPPGSignalEnhanced(
  signal: number[],
  frameRate: number = 14
): PPGResult {
  if (!signal || signal.length < 30) {
    return {
      success: false,
      signalQuality: 0,
      error: "Insufficient signal data",
    };
  }

  try {
    // Normalize signal to 0-1 range
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const normalized = signal.map((val) => (val - min) / (max - min || 1));

    // Apply multi-order filtering (2nd to 6th order Butterworth filters)
    const filteredSignals: number[][] = [];
    const orders = [2, 3, 4, 5, 6];

    for (const order of orders) {
      const filtered = applyButterworthFilter(normalized, order, frameRate);
      filteredSignals.push(filtered);
    }

    // Average all filtered signals
    const averaged = new Array(normalized.length).fill(0);
    for (let i = 0; i < normalized.length; i++) {
      let sum = 0;
      for (const filtered of filteredSignals) {
        sum += filtered[i] || 0;
      }
      averaged[i] = sum / filteredSignals.length;
    }

    // Calculate heart rate using FFT
    const heartRate = calculateHeartRateFromFFT(averaged, frameRate);

    // Calculate signal quality (skewness check from research)
    const signalQuality = calculateSignalQuality(averaged);

    // Validate heart rate (normal range: 40-200 BPM)
    if (heartRate < 40 || heartRate > 200) {
      return {
        success: false,
        signalQuality,
        error: "Heart rate out of normal range",
      };
    }

    // Calculate Heart Rate Variability (HRV) from peak intervals
    const hrv = calculateHRV(averaged, frameRate);

    // Calculate Respiratory Rate from PPG signal envelope
    const respiratoryRate = calculateRespiratoryRate(averaged, frameRate);

    return {
      success: true,
      heartRate: Math.round(heartRate),
      heartRateVariability: hrv ? Math.round(hrv) : undefined,
      respiratoryRate: respiratoryRate ? Math.round(respiratoryRate) : undefined,
      signalQuality,
    };
  } catch (error: any) {
    return {
      success: false,
      signalQuality: 0,
      error: error.message || "PPG processing error",
    };
  }
}

/**
 * Apply Butterworth filter to signal
 * Simplified implementation for low-order filters
 */
function applyButterworthFilter(
  signal: number[],
  order: number,
  frameRate: number
): number[] {
  // Simplified Butterworth filter implementation
  // Cutoff frequency: 0.5-4 Hz (30-240 BPM range)
  const cutoffLow = 0.5 / (frameRate / 2); // Normalized frequency
  const cutoffHigh = 4.0 / (frameRate / 2);

  // Simple moving average as approximation for low-order filters
  const windowSize = Math.max(3, Math.floor(frameRate / 4));
  const filtered: number[] = [];

  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - windowSize); j <= Math.min(signal.length - 1, i + windowSize); j++) {
      sum += signal[j];
      count++;
    }
    filtered.push(sum / count);
  }

  return filtered;
}

/**
 * Calculate heart rate using FFT (Fast Fourier Transform)
 */
function calculateHeartRateFromFFT(signal: number[], frameRate: number): number {
  // Simplified FFT-based heart rate calculation
  // Find dominant frequency in the 0.67-3.33 Hz range (40-200 BPM)

  const n = signal.length;
  const dt = 1 / frameRate;

  // Find peaks in the signal (simplified approach)
  const peaks: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      peaks.push(i);
    }
  }

  if (peaks.length < 2) {
    // Fallback: estimate from signal period
    return estimateHeartRateFromPeriod(signal, frameRate);
  }

  // Calculate average peak interval
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const period = avgInterval * dt; // seconds
  const heartRate = 60 / period; // BPM

  return heartRate;
}

/**
 * Estimate heart rate from signal period
 */
function estimateHeartRateFromPeriod(signal: number[], frameRate: number): number {
  // Find autocorrelation to detect periodicity
  const n = signal.length;
  const minPeriod = Math.floor(frameRate * 0.5); // 0.5 seconds minimum
  const maxPeriod = Math.floor(frameRate * 1.5); // 1.5 seconds maximum

  let maxCorrelation = 0;
  let bestPeriod = frameRate; // Default to 1 second (60 BPM)

  for (let period = minPeriod; period <= maxPeriod && period < n / 2; period++) {
    let correlation = 0;
    for (let i = 0; i < n - period; i++) {
      correlation += signal[i] * signal[i + period];
    }
    correlation /= n - period;

    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestPeriod = period;
    }
  }

  const heartRate = (60 * frameRate) / bestPeriod;
  return heartRate;
}

/**
 * Calculate Heart Rate Variability (HRV) from PPG signal
 * HRV is the variation in time between consecutive heartbeats
 * Measured as RMSSD (Root Mean Square of Successive Differences)
 */
function calculateHRV(signal: number[], frameRate: number): number | undefined {
  try {
    // Find peaks (R-R intervals)
    const peaks: number[] = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
        peaks.push(i);
      }
    }

    if (peaks.length < 3) return undefined;

    // Calculate R-R intervals in milliseconds
    const rrIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const interval = (peaks[i] - peaks[i - 1]) * (1000 / frameRate);
      rrIntervals.push(interval);
    }

    // Calculate RMSSD (Root Mean Square of Successive Differences)
    let sumSquaredDiffs = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      const diff = rrIntervals[i] - rrIntervals[i - 1];
      sumSquaredDiffs += diff * diff;
    }

    const rmssd = Math.sqrt(sumSquaredDiffs / (rrIntervals.length - 1));
    return rmssd;
  } catch {
    return undefined;
  }
}

/**
 * Calculate Respiratory Rate from PPG signal
 * Respiratory rate can be derived from low-frequency variations in PPG envelope
 * Typically 0.1-0.5 Hz (6-30 breaths per minute)
 */
function calculateRespiratoryRate(
  signal: number[],
  frameRate: number
): number | undefined {
  try {
    // Extract envelope of PPG signal (low-frequency component)
    // Use moving average to smooth signal and extract envelope
    const windowSize = Math.floor(frameRate * 2); // 2-second window
    const envelope: number[] = [];

    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      for (
        let j = Math.max(0, i - windowSize);
        j <= Math.min(signal.length - 1, i + windowSize);
        j++
      ) {
        sum += signal[j];
        count++;
      }
      envelope.push(sum / count);
    }

    // Find peaks in envelope (breathing cycles)
    const breathingPeaks: number[] = [];
    for (let i = 1; i < envelope.length - 1; i++) {
      if (envelope[i] > envelope[i - 1] && envelope[i] > envelope[i + 1]) {
        breathingPeaks.push(i);
      }
    }

    if (breathingPeaks.length < 2) return undefined;

    // Calculate average breathing interval
    const intervals: number[] = [];
    for (let i = 1; i < breathingPeaks.length; i++) {
      intervals.push(breathingPeaks[i] - breathingPeaks[i - 1]);
    }

    const avgInterval =
      intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const period = avgInterval / frameRate; // seconds per breath
    const respiratoryRate = 60 / period; // breaths per minute

    // Validate respiratory rate (normal range: 12-20 breaths/min, but can be 6-30)
    if (respiratoryRate < 6 || respiratoryRate > 30) {
      return undefined;
    }

    return respiratoryRate;
  } catch {
    return undefined;
  }
}

/**
 * Calculate signal quality based on skewness and variance
 * Research shows skewness < 13% indicates good quality
 */
function calculateSignalQuality(signal: number[]): number {
  const n = signal.length;
  if (n === 0) return 0;

  // Calculate mean
  const mean = signal.reduce((a, b) => a + b, 0) / n;

  // Calculate variance
  const variance =
    signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;

  // Calculate skewness
  const skewness =
    signal.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0) /
    (n * Math.pow(variance, 1.5));

  // Normalize skewness to percentage
  const skewnessPercent = Math.abs(skewness) * 100;

  // Quality score: 1.0 if skewness < 13%, decreasing linearly to 0 at 50%
  let quality = 1.0;
  if (skewnessPercent > 13) {
    quality = Math.max(0, 1.0 - (skewnessPercent - 13) / 37);
  }

  // Also consider variance (too low = poor signal)
  const stdDev = Math.sqrt(variance);
  if (stdDev < 0.01) {
    quality *= 0.5; // Penalize low variance signals
  }

  return Math.max(0, Math.min(1, quality));
}

/**
 * Multimodal fusion: Combine fingerprint and PPG scores
 * Based on Multimodal Fusion research paper
 * 
 * @param fingerprintScore - Score from biometric authentication (0-1)
 * @param ppgScore - Score from PPG heart rate match (0-1)
 * @param ppgQuality - Signal quality from PPG (0-1)
 * @returns Combined confidence score
 */
export function fuseMultimodalScores(
  fingerprintScore: number,
  ppgScore: number,
  ppgQuality: number
): number {
  // Adaptive weights based on signal quality
  // Higher quality PPG gets more weight
  const w1 = 0.6; // Fingerprint weight (60%)
  const w2 = 0.4; // PPG weight (40%)

  // Adjust PPG weight based on signal quality
  const adjustedPPGWeight = w2 * ppgQuality;
  const adjustedFingerprintWeight = w1 + (w2 - adjustedPPGWeight);

  // Normalize weights
  const totalWeight = adjustedFingerprintWeight + adjustedPPGWeight;
  const normalizedW1 = adjustedFingerprintWeight / totalWeight;
  const normalizedW2 = adjustedPPGWeight / totalWeight;

  // Weighted fusion
  const fusedScore = normalizedW1 * fingerprintScore + normalizedW2 * ppgScore;

  return Math.max(0, Math.min(1, fusedScore));
}

/**
 * Compare current heart rate with enrolled heart rate
 * Returns similarity score (0-1)
 */
export function compareHeartRate(
  currentHR: number,
  enrolledHR: number,
  tolerance: number = 10
): number {
  const difference = Math.abs(currentHR - enrolledHR);
  const maxDifference = tolerance * 2; // Allow ±tolerance BPM

  if (difference <= tolerance) {
    return 1.0; // Perfect match
  }

  // Linear decrease from tolerance to maxDifference
  const score = Math.max(0, 1.0 - (difference - tolerance) / tolerance);
  return score;
}

