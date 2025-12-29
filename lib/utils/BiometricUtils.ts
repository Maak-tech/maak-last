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
    } catch {
      return null;
    }
  }
  return LocalAuthentication;
}

export interface BiometricAvailability {
  available: boolean;
  supportedTypes: string[];
  isBiometricEnrolled: boolean; // Always present for compatibility
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
      isBiometricEnrolled: false,
      error: "Biometric authentication module not available",
    };
    }

    const compatible = await LocalAuth.hasHardwareAsync();
    if (!compatible) {
      return {
        available: false,
        supportedTypes: [],
        isBiometricEnrolled: false,
        error: "Biometric hardware not available",
      };
    }

    const enrolled = await LocalAuth.isEnrolledAsync();
    if (!enrolled) {
      return {
        available: false,
        supportedTypes: [],
        isBiometricEnrolled: false,
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
      isBiometricEnrolled: true,
    };
  } catch (error: any) {
    return {
      available: false,
      supportedTypes: [],
      isBiometricEnrolled: false,
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
    // Validate signal values
    const validSignal = signal.filter(val => !isNaN(val) && val >= 0 && val <= 255);
    if (validSignal.length < signal.length * 0.8) {
      return {
        success: false,
        signalQuality: 0,
        error: "Too many invalid signal values",
      };
    }

    // Normalize signal to 0-1 range
    const min = Math.min(...validSignal);
    const max = Math.max(...validSignal);
    const range = max - min;
    
    if (range < 5) {
      return {
        success: false,
        signalQuality: 0,
        error: "Signal variation too low",
      };
    }
    
    const normalized = validSignal.map((val) => (val - min) / range);

    // Apply optimized filtering
    const filtered = applyOptimizedFilter(normalized, frameRate);

    // Calculate heart rate using improved peak detection
    const heartRate = calculateHeartRateOptimized(filtered, frameRate);

    // Calculate signal quality
    const signalQuality = calculateSignalQualityOptimized(filtered);

    // Validate heart rate (normal range: 40-200 BPM)
    if (heartRate < 40 || heartRate > 200) {
      return {
        success: false,
        signalQuality,
        error: "Heart rate out of normal range",
      };
    }

    // Calculate additional metrics
    const hrv = calculateHRVOptimized(filtered, frameRate);
    const respiratoryRate = calculateRespiratoryRateOptimized(filtered, frameRate);

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
 * Apply optimized filter to signal (simplified but effective)
 */
function applyOptimizedFilter(
  signal: number[],
  frameRate: number
): number[] {
  // Use a simple but effective moving average filter
  const windowSize = Math.max(3, Math.floor(frameRate / 4));
  const filtered: number[] = [];

  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    const start = Math.max(0, i - windowSize);
    const end = Math.min(signal.length - 1, i + windowSize);
    
    for (let j = start; j <= end; j++) {
      sum += signal[j];
      count++;
    }
    filtered.push(sum / count);
  }

  return filtered;
}

/**
 * Optimized heart rate calculation using peak detection
 */
function calculateHeartRateOptimized(signal: number[], frameRate: number): number {
  // Find peaks with minimum distance constraint
  const minPeakDistance = Math.floor(frameRate * 0.4); // Minimum 0.4s between peaks (150 BPM max)
  const peaks: number[] = [];
  
  // Calculate threshold as percentage of signal range
  const min = Math.min(...signal);
  const max = Math.max(...signal);
  const threshold = min + (max - min) * 0.3; // 30% above minimum
  
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && 
        signal[i] > signal[i + 1] && 
        signal[i] > threshold) {
      // Check minimum distance from last peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minPeakDistance) {
        peaks.push(i);
      }
    }
  }

  if (peaks.length < 2) {
    return estimateHeartRateFromPeriod(signal, frameRate);
  }

  // Calculate average peak interval
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  // Remove outliers (values more than 50% different from median)
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  
  // Guard against division by zero - if median is 0, skip filtering
  const filteredIntervals = median > 0
    ? intervals.filter(interval => 
        Math.abs(interval - median) / median < 0.5
      )
    : intervals;

  if (filteredIntervals.length === 0) {
    return estimateHeartRateFromPeriod(signal, frameRate);
  }

  const avgInterval = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;
  const period = avgInterval / frameRate; // seconds
  const heartRate = 60 / period; // BPM

  return heartRate;
}

/**
 * Optimized signal quality calculation
 */
function calculateSignalQualityOptimized(signal: number[]): number {
  const n = signal.length;
  if (n === 0) return 0;

  // Calculate basic statistics
  const mean = signal.reduce((a, b) => a + b, 0) / n;
  const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Quality based on signal-to-noise ratio
  let quality = 1.0;

  // Penalize low variation (too uniform)
  if (stdDev < 0.05) {
    quality *= stdDev / 0.05;
  }

  // Penalize excessive variation (too noisy)
  if (stdDev > 0.3) {
    quality *= Math.max(0, 1 - (stdDev - 0.3) / 0.5);
  }

  return Math.max(0, Math.min(1, quality));
}

/**
 * Optimized HRV calculation
 */
function calculateHRVOptimized(signal: number[], frameRate: number): number | undefined {
  try {
    const peaks: number[] = [];
    const threshold = 0.3; // 30% of signal range
    
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && 
          signal[i] > signal[i + 1] && 
          signal[i] > threshold) {
        peaks.push(i);
      }
    }

    if (peaks.length < 3) return undefined;

    // Calculate R-R intervals in milliseconds
    const rrIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const interval = (peaks[i] - peaks[i - 1]) * (1000 / frameRate);
      if (interval > 300 && interval < 2000) { // Valid R-R interval range
        rrIntervals.push(interval);
      }
    }

    if (rrIntervals.length < 2) return undefined;

    // Calculate RMSSD
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
 * Optimized respiratory rate calculation
 */
function calculateRespiratoryRateOptimized(
  signal: number[],
  frameRate: number
): number | undefined {
  try {
    // Extract envelope using larger window for respiratory component
    const windowSize = Math.floor(frameRate * 3); // 3-second window
    const envelope: number[] = [];

    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      const start = Math.max(0, i - windowSize);
      const end = Math.min(signal.length - 1, i + windowSize);
      
      for (let j = start; j <= end; j++) {
        sum += signal[j];
        count++;
      }
      envelope.push(sum / count);
    }

    // Find breathing peaks with appropriate spacing
    const minBreathDistance = Math.floor(frameRate * 2); // Minimum 2s between breaths (30 breaths/min max)
    const breathingPeaks: number[] = [];
    
    for (let i = 1; i < envelope.length - 1; i++) {
      if (envelope[i] > envelope[i - 1] && envelope[i] > envelope[i + 1]) {
        if (breathingPeaks.length === 0 || i - breathingPeaks[breathingPeaks.length - 1] >= minBreathDistance) {
          breathingPeaks.push(i);
        }
      }
    }

    if (breathingPeaks.length < 2) return undefined;

    // Calculate average breathing interval
    const intervals: number[] = [];
    for (let i = 1; i < breathingPeaks.length; i++) {
      intervals.push(breathingPeaks[i] - breathingPeaks[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const period = avgInterval / frameRate; // seconds per breath
    const respiratoryRate = 60 / period; // breaths per minute

    // Validate respiratory rate (normal range: 6-30 breaths/min)
    if (respiratoryRate < 6 || respiratoryRate > 30) {
      return undefined;
    }

    return respiratoryRate;
  } catch {
    return undefined;
  }
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

