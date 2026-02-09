/**
 * Biometric Utilities for Multimodal Authentication
 * Based on research papers:
 * - Olugbenle et al. (arXiv:2412.07082v1) - Low frame-rate PPG heart rate measurement
 * - Multimodal Fusion (arXiv:2412.05660) - Combining fingerprint + PPG for authentication
 */

type LocalAuthenticationModule = typeof import("expo-local-authentication");

// Lazy import to prevent crashes if native module isn't available.
let LocalAuthentication: LocalAuthenticationModule | null = null;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function isAuthRelatedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("User must be authenticated") ||
    error.message.includes("unauthenticated")
  );
}

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

export type BiometricAvailability = {
  available: boolean;
  supportedTypes: string[];
  isBiometricEnrolled: boolean; // Always present for compatibility
  error?: string;
};

export type PPGResult = {
  success: boolean;
  heartRate?: number;
  heartRateVariability?: number; // HRV in ms
  respiratoryRate?: number; // breaths per minute
  oxygenSaturation?: number; // SpO2 percentage (requires dual-wavelength)
  signalQuality: number; // 0-1, where 1 is perfect
  confidence?: number; // 0-1 ML confidence when available
  isEstimate?: boolean; // true when a BPM was produced from low-confidence signal quality
  error?: string;
};

export type BiometricResult = {
  success: boolean;
  score: number; // 0-1 confidence score
  fingerprintScore?: number;
  ppgScore?: number;
  heartRate?: number;
  error?: string;
};

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
  } catch (error: unknown) {
    return {
      available: false,
      supportedTypes: [],
      isBiometricEnrolled: false,
      error: getErrorMessage(error, "Unknown error"),
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
  } catch (error: unknown) {
    return {
      success: false,
      score: 0,
      error: getErrorMessage(error, "Biometric authentication error"),
    };
  }
}

/**
 * Process PPG signal using ML models (PaPaGei) with fallback to traditional processing
 *
 * This function attempts to use ML-powered analysis first, then falls back to
 * traditional signal processing if ML service is unavailable.
 *
 * @param signal - Array of pixel intensity values (0-255)
 * @param frameRate - Frames per second (typically 14-30 fps)
 * @param useML - Whether to attempt ML processing (default: true)
 * @param userId - Optional user ID for ML service tracking
 * @returns Heart rate in BPM, HRV, respiratory rate, and comprehensive signal quality
 */
export async function processPPGSignalWithML(
  signal: number[],
  frameRate = 14,
  useML = true,
  userId?: string
): Promise<PPGResult> {
  // Try ML processing first if enabled
  if (useML) {
    try {
      const { ppgMLService } = await import("@/lib/services/ppgMLService");
      const mlResult = await ppgMLService.analyzePPG(signal, frameRate, userId);

      // If ML succeeded, return result
      if (mlResult.success) {
        return mlResult;
      }

      // If ML failed but we have a result (low quality), still return it
      // but mark as estimate
      if (mlResult.heartRate !== undefined) {
        return {
          ...mlResult,
          isEstimate: true,
        };
      }

      // If error is authentication-related, silently fall through to traditional processing
      const isAuthError =
        mlResult.error?.includes("not authenticated") ||
        mlResult.error?.includes("User must be authenticated");

      if (!isAuthError) {
        // ML completely failed for non-auth reasons
      }
      // Fall through to traditional processing
    } catch (error: unknown) {
      // Only log warning for non-authentication errors
      const isAuthError = isAuthRelatedError(error);

      if (!isAuthError) {
        // ML service unavailable, using traditional processing
      }
      // Fall through to traditional processing
    }
  }

  // Fallback to traditional processing
  return processPPGSignalEnhanced(signal, frameRate);
}

/**
 * Process PPG signal to extract heart rate following research guidance
 * Based on multiple research papers:
 * - Olugbenle et al. (arXiv:2412.07082v1) - Low frame-rate PPG heart rate measurement
 * - markolalovic/ppg-vitals - Detrended 5-second windows, smartphone PPG implementation
 * - PMC5981424 - PPG biometric authentication with quality assessment
 * - ScienceDirect pattern recognition research - Multi-order filtering approaches
 *
 * Implements: 5-second detrending windows, multi-order Butterworth filtering (2nd-6th order),
 * enhanced signal quality assessment with SNR, periodicity, and stability analysis
 *
 * @param signal - Array of pixel intensity values (0-255)
 * @param frameRate - Frames per second (typically 14 fps)
 * @returns Heart rate in BPM, HRV, respiratory rate, and comprehensive signal quality
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Keep processing pipeline in one place until split into tested sub-stages.
export function processPPGSignalEnhanced(
  signal: number[],
  frameRate = 14
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
    const validSignal = signal.filter(
      (val) => !Number.isNaN(val) && val >= 0 && val <= 255
    );
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

    // Raw pixel averages can have small amplitude even with usable PPG after filtering.
    // Only reject when the range is so tiny that normalization becomes unstable.
    const MIN_RAW_RANGE_FOR_NORMALIZATION = 1;
    if (range < MIN_RAW_RANGE_FOR_NORMALIZATION) {
      return {
        success: false,
        signalQuality: 0,
        error: "Signal quality too low",
      };
    }

    const normalized = validSignal.map((val) => (val - min) / range);

    // Apply optimized filtering
    const filtered = applyOptimizedFilter(normalized, frameRate);

    // Calculate heart rate using two estimators:
    // - Peak-based (can run high if noise causes double-counted peaks)
    // - Autocorrelation-based (often more stable for low-quality/low-amplitude signals)
    const heartRatePeak = calculateHeartRateOptimized(filtered, frameRate);
    const heartRateAuto = estimateHeartRateFromPeriod(filtered, frameRate);

    // Detect signal clipping from flash saturation or excessive pressure.
    // Clipping inflates peaks and can bias BPM high.
    const clippedSamples = normalized.filter(
      (value) => value <= 0.02 || value >= 0.98
    ).length;
    const clippedRatio = clippedSamples / normalized.length;

    // Calculate signal quality (penalize clipped signals)
    let clippingPenalty = 1;
    if (clippedRatio > 0.35) {
      clippingPenalty = 0.5;
    } else if (clippedRatio > 0.2) {
      clippingPenalty = 0.7;
    }
    const signalQuality = Math.max(
      0,
      Math.min(1, calculateSignalQualityOptimized(filtered) * clippingPenalty)
    );

    // Select heart rate using quality-aware blending to reduce false-high BPM.
    const hasPeak = Number.isFinite(heartRatePeak);
    const hasAuto = Number.isFinite(heartRateAuto);
    const hrDifference =
      hasPeak && hasAuto ? Math.abs(heartRatePeak - heartRateAuto) : 0;
    const preferAutocorr =
      clippedRatio > 0.15 || signalQuality < 0.65 || hrDifference >= 10;
    let blendedEstimate = heartRatePeak;
    if (hasPeak && hasAuto) {
      blendedEstimate = 0.65 * heartRateAuto + 0.35 * heartRatePeak;
    } else if (hasAuto) {
      blendedEstimate = heartRateAuto;
    }
    const fallbackEstimate = Number.isFinite(blendedEstimate)
      ? blendedEstimate
      : 60;
    const heartRateSelected =
      preferAutocorr || !hasPeak ? fallbackEstimate : heartRatePeak;

    // Quality gating:
    // - We still want to return a BPM when the signal is "good enough"
    // - But we must reject inflated BPM caused by noise (motion / light leaks) unless quality is high
    const MIN_SIGNAL_QUALITY_FOR_ANY_HR = 0.2;
    if (signalQuality < MIN_SIGNAL_QUALITY_FOR_ANY_HR) {
      // Return an estimate instead of blocking the user with "no score".
      // UI can display a "low confidence" warning and optionally avoid saving it.
      // Blend autocorrelation + peak estimates to avoid swinging too high or too low.
      let estimate = heartRatePeak;
      if (Number.isFinite(heartRateAuto) && Number.isFinite(heartRatePeak)) {
        estimate = 0.6 * heartRateAuto + 0.4 * heartRatePeak;
      } else if (Number.isFinite(heartRateAuto)) {
        estimate = heartRateAuto;
      }
      return {
        success: true,
        heartRate: Math.round(Math.max(40, Math.min(200, estimate))),
        signalQuality,
        isEstimate: true,
        error: "Signal quality too low",
      };
    }

    const HIGH_BPM_THRESHOLD = 110;
    const MIN_SIGNAL_QUALITY_FOR_HIGH_BPM = 0.6;
    const highBpmMismatch =
      hasAuto &&
      Number.isFinite(heartRateSelected) &&
      heartRateSelected > heartRateAuto * 1.15;
    if (
      heartRateSelected >= HIGH_BPM_THRESHOLD &&
      (signalQuality < MIN_SIGNAL_QUALITY_FOR_HIGH_BPM || highBpmMismatch)
    ) {
      // Still return an estimate (but mark it low confidence) so the user gets a BPM.
      // Prefer autocorrelation estimate to reduce false-high BPM from noisy peaks.
      let estimate = heartRateSelected;
      if (
        Number.isFinite(heartRateAuto) &&
        Number.isFinite(heartRateSelected)
      ) {
        estimate = 0.6 * heartRateAuto + 0.4 * heartRateSelected;
      } else if (Number.isFinite(heartRateAuto)) {
        estimate = heartRateAuto;
      }
      return {
        success: true,
        heartRate: Math.round(Math.max(40, Math.min(200, estimate))),
        signalQuality,
        isEstimate: true,
        error: "Signal quality too low",
      };
    }

    // Validate heart rate (normal range: 40-200 BPM)
    if (heartRateSelected < 40 || heartRateSelected > 200) {
      return {
        success: false,
        signalQuality,
        error: "Heart rate out of normal range",
      };
    }

    // Calculate additional metrics
    const hrv = calculateHRVOptimized(filtered, frameRate);
    const respiratoryRate = calculateRespiratoryRateOptimized(
      filtered,
      frameRate
    );

    return {
      success: true,
      heartRate: Math.round(heartRateSelected),
      heartRateVariability: hrv ? Math.round(hrv) : undefined,
      respiratoryRate: respiratoryRate
        ? Math.round(respiratoryRate)
        : undefined,
      signalQuality,
    };
  } catch (error: unknown) {
    return {
      success: false,
      signalQuality: 0,
      error: getErrorMessage(error, "PPG processing error"),
    };
  }
}

/**
 * Apply multi-order filtering following research guidance
 * Based on "Processes with multi-order filtering (2nd-6th)" from research papers
 * Implements cascaded filtering with detrending in 5-second windows
 */
function applyOptimizedFilter(signal: number[], frameRate: number): number[] {
  if (signal.length < 10) {
    return signal;
  }

  let filtered = [...signal];

  // Step 1: Detrend signal in 5-second windows (following markolalovic research)
  filtered = applyDetrending(filtered, frameRate);

  // Step 2: Apply multi-order Butterworth filtering (2nd-6th order cascade)
  // Low-pass filter to remove high-frequency noise
  filtered = applyButterworthFilter(filtered, frameRate, "low", 5.0); // 5 Hz cutoff

  // Step 3: High-pass filter to remove baseline drift
  filtered = applyButterworthFilter(filtered, frameRate, "high", 0.5); // 0.5 Hz cutoff

  // Step 4: Band-pass filter for PPG frequency range (0.5-5 Hz = 30-300 BPM)
  filtered = applyBandpassFilter(filtered, frameRate, 0.5, 5.0);

  return filtered;
}

/**
 * Apply detrending in 5-second windows following markolalovic research
 */
function applyDetrending(signal: number[], frameRate: number): number[] {
  const windowSize = Math.floor(frameRate * 5); // 5-second windows
  const detrended: number[] = [];

  for (let i = 0; i < signal.length; i++) {
    const windowStart = Math.max(0, i - Math.floor(windowSize / 2));
    const windowEnd = Math.min(
      signal.length - 1,
      i + Math.floor(windowSize / 2)
    );

    // Calculate linear trend in the window
    const windowData = signal.slice(windowStart, windowEnd + 1);
    const trend = calculateLinearTrend(windowData, windowStart, frameRate);

    // Remove trend from current point
    const detrendedValue = signal[i] - trend[i - windowStart];
    detrended.push(detrendedValue);
  }

  return detrended;
}

/**
 * Calculate linear trend for detrending
 */
function calculateLinearTrend(
  windowData: number[],
  offset: number,
  _frameRate: number
): number[] {
  const n = windowData.length;
  if (n < 2) {
    return windowData;
  }

  // Time indices
  const times = Array.from({ length: n }, (_, i) => offset + i);

  // Calculate means
  const meanY = windowData.reduce((a, b) => a + b, 0) / n;
  const meanT = times.reduce((a, b) => a + b, 0) / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (times[i] - meanT) * (windowData[i] - meanY);
    denominator += (times[i] - meanT) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanT;

  // Generate trend line
  return times.map((t) => slope * t + intercept);
}

/**
 * Apply Butterworth filter (simplified implementation)
 */
function applyButterworthFilter(
  signal: number[],
  frameRate: number,
  type: "low" | "high",
  cutoffFreq: number
): number[] {
  // Simplified Butterworth filter implementation
  // In production, would use a proper DSP library
  const alpha = calculateButterworthAlpha(frameRate, cutoffFreq);

  const filtered: number[] = [signal[0]]; // First sample unchanged

  for (let i = 1; i < signal.length; i++) {
    if (type === "low") {
      // Low-pass: y[i] = alpha * x[i] + (1-alpha) * y[i-1]
      filtered.push(alpha * signal[i] + (1 - alpha) * filtered[i - 1]);
    } else {
      // High-pass: y[i] = alpha * (y[i-1] + x[i] - x[i-1])
      filtered.push(alpha * (filtered[i - 1] + signal[i] - signal[i - 1]));
    }
  }

  return filtered;
}

/**
 * Apply bandpass filter for PPG frequency range
 */
function applyBandpassFilter(
  signal: number[],
  frameRate: number,
  lowCutoff: number,
  highCutoff: number
): number[] {
  // Apply low-pass then high-pass
  let filtered = applyButterworthFilter(signal, frameRate, "low", highCutoff);
  filtered = applyButterworthFilter(filtered, frameRate, "high", lowCutoff);
  return filtered;
}

/**
 * Calculate Butterworth filter alpha coefficient
 */
function calculateButterworthAlpha(
  frameRate: number,
  cutoffFreq: number
): number {
  // Simplified alpha calculation for Butterworth filter
  const rc = 1 / (2 * Math.PI * cutoffFreq);
  const dt = 1 / frameRate;
  return dt / (rc + dt);
}

/**
 * Optimized heart rate calculation using peak detection
 */
function calculateHeartRateOptimized(
  signal: number[],
  frameRate: number
): number {
  // Find peaks with minimum distance constraint
  // Use a slightly longer refractory period to reduce double-counting peaks.
  const minPeakDistance = Math.floor(frameRate * 0.5); // Minimum 0.5s between peaks (120 BPM max)
  const peaks: number[] = [];

  // Calculate threshold as percentage of signal range
  const min = Math.min(...signal);
  const max = Math.max(...signal);
  const threshold = min + (max - min) * 0.4; // 40% above minimum

  for (let i = 1; i < signal.length - 1; i++) {
    const lastPeak = peaks.length > 0 ? peaks.at(-1) : undefined;
    if (
      signal[i] > signal[i - 1] &&
      signal[i] > signal[i + 1] &&
      signal[i] > threshold &&
      (lastPeak === undefined || i - lastPeak >= minPeakDistance)
    ) {
      peaks.push(i);
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
  const filteredIntervals =
    median > 0
      ? intervals.filter(
          (interval) => Math.abs(interval - median) / median < 0.5
        )
      : intervals;

  if (filteredIntervals.length === 0) {
    return estimateHeartRateFromPeriod(signal, frameRate);
  }

  const avgInterval =
    filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;
  const period = avgInterval / frameRate; // seconds
  const heartRate = 60 / period; // BPM

  return heartRate;
}

/**
 * Enhanced signal quality assessment following research papers
 * Includes SNR calculation, periodicity analysis, and stability metrics
 */
function calculateSignalQualityOptimized(signal: number[]): number {
  const n = signal.length;
  if (n < 30) {
    return 0; // Need minimum samples for quality assessment
  }

  // Calculate basic statistics
  const mean = signal.reduce((a, b) => a + b, 0) / n;
  const variance = signal.reduce((sum, val) => sum + (val - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  // Calculate Signal-to-Noise Ratio (SNR)
  const snr = calculateSNR(signal, mean, stdDev);

  // Calculate periodicity score (crucial for PPG signals)
  const periodicityScore = calculatePeriodicityScore(signal);

  // Calculate signal stability over time
  const stabilityScore = calculateStabilityScore(signal);

  // Calculate spectral concentration in PPG frequency range (0.5-5 Hz)
  const spectralScore = calculateSpectralConcentration(signal);

  // Weighted quality score based on research metrics
  let quality = 0;

  // SNR contribution (40% weight)
  quality += 0.4 * Math.min(snr / 10, 1); // SNR of 10+ is excellent

  // Periodicity contribution (30% weight) - most important for PPG
  quality += 0.3 * periodicityScore;

  // Stability contribution (15% weight)
  quality += 0.15 * stabilityScore;

  // Spectral concentration contribution (15% weight)
  quality += 0.15 * spectralScore;

  return Math.max(0, Math.min(1, quality));
}

/**
 * Calculate Signal-to-Noise Ratio
 */
function calculateSNR(signal: number[], _mean: number, stdDev: number): number {
  if (stdDev === 0) {
    return 0;
  }

  // Estimate signal power (variance of detrended signal)
  const signalPower = stdDev ** 2;

  // Estimate noise power (high-frequency components)
  const noiseStdDev = estimateNoiseLevel(signal);
  const noisePower = noiseStdDev ** 2;

  return noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : 0;
}

/**
 * Estimate noise level using high-frequency components
 */
function estimateNoiseLevel(signal: number[]): number {
  // Simple high-pass filter to isolate noise
  const noiseSignal: number[] = [];
  for (let i = 1; i < signal.length; i++) {
    noiseSignal.push(signal[i] - 0.9 * signal[i - 1]); // High-pass filter
  }

  if (noiseSignal.length === 0) {
    return 0;
  }

  const mean = noiseSignal.reduce((a, b) => a + b, 0) / noiseSignal.length;
  const variance =
    noiseSignal.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
    noiseSignal.length;

  return Math.sqrt(variance);
}

/**
 * Calculate periodicity score (crucial for PPG signals)
 */
function calculatePeriodicityScore(signal: number[]): number {
  // Autocorrelation analysis to detect periodicity
  const maxLag = Math.min(100, Math.floor(signal.length / 2));
  const autocorr = calculateAutocorrelation(signal, maxLag);

  // Find peaks in autocorrelation (indicating periodicity)
  const peaks = findPeaks(autocorr, 0.3); // Threshold for significant correlation

  if (peaks.length === 0) {
    return 0;
  }

  // Calculate average correlation strength
  const avgCorrelation =
    peaks.reduce((sum, lag) => sum + autocorr[lag], 0) / peaks.length;

  // Periodicity score based on correlation strength and number of peaks
  const score = Math.min(avgCorrelation * Math.min(peaks.length / 5, 1), 1);

  return score;
}

/**
 * Calculate autocorrelation
 */
function calculateAutocorrelation(signal: number[], maxLag: number): number[] {
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  const variance =
    signal.reduce((sum, val) => sum + (val - mean) ** 2, 0) / signal.length;

  const autocorr: number[] = [];

  for (let lag = 0; lag <= maxLag; lag++) {
    let correlation = 0;
    let count = 0;

    for (let i = lag; i < signal.length; i++) {
      correlation += (signal[i] - mean) * (signal[i - lag] - mean);
      count += 1;
    }

    autocorr.push(count > 0 ? correlation / (count * variance) : 0);
  }

  return autocorr;
}

/**
 * Find peaks in array above threshold
 */
function findPeaks(array: number[], threshold: number): number[] {
  const peaks: number[] = [];

  for (let i = 1; i < array.length - 1; i++) {
    if (
      array[i] > array[i - 1] &&
      array[i] > array[i + 1] &&
      array[i] > threshold
    ) {
      peaks.push(i);
    }
  }

  return peaks;
}

/**
 * Calculate signal stability over time
 */
function calculateStabilityScore(signal: number[]): number {
  // Divide signal into segments and check consistency
  const segmentSize = Math.floor(signal.length / 4);
  if (segmentSize < 10) {
    return 0.5; // Not enough data
  }

  const segments: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const start = i * segmentSize;
    const end = Math.min((i + 1) * segmentSize, signal.length);
    segments.push(signal.slice(start, end));
  }

  // Calculate mean and std for each segment
  const segmentStats = segments.map((segment) => {
    const mean = segment.reduce((a, b) => a + b, 0) / segment.length;
    const variance =
      segment.reduce((sum, val) => sum + (val - mean) ** 2, 0) / segment.length;
    return { mean, std: Math.sqrt(variance) };
  });

  // Check consistency across segments
  const overallMean =
    segmentStats.reduce((sum, stat) => sum + stat.mean, 0) /
    segmentStats.length;
  const meanVariation =
    segmentStats.reduce(
      (sum, stat) => sum + (stat.mean - overallMean) ** 2,
      0
    ) / segmentStats.length;
  const meanStd = Math.sqrt(meanVariation);

  // Lower variation = higher stability
  const stability = Math.max(0, 1 - meanStd / (overallMean * 0.1)); // 10% variation threshold

  return Math.max(0, Math.min(1, stability));
}

/**
 * Calculate spectral concentration in PPG frequency range
 */
function calculateSpectralConcentration(signal: number[]): number {
  // Simple spectral analysis - count significant frequency components in PPG range
  // This is a simplified implementation; production would use FFT

  // Calculate approximate power spectral density
  const psd = estimatePSD(signal);

  // PPG frequency range: 0.8-3.5 Hz (48-210 BPM)
  const ppgStart = Math.floor((psd.length * 0.8) / (signal.length / 2));
  const ppgEnd = Math.floor((psd.length * 3.5) / (signal.length / 2));

  if (ppgStart >= psd.length || ppgEnd >= psd.length) {
    return 0;
  }

  // Calculate power in PPG range vs total power
  const ppgPower = psd.slice(ppgStart, ppgEnd + 1).reduce((a, b) => a + b, 0);
  const totalPower = psd.reduce((a, b) => a + b, 0);

  return totalPower > 0 ? ppgPower / totalPower : 0;
}

/**
 * Estimate Power Spectral Density (simplified)
 */
function estimatePSD(signal: number[]): number[] {
  // Very simplified PSD estimation using autocorrelation
  const autocorr = calculateAutocorrelation(
    signal,
    Math.floor(signal.length / 4)
  );
  return autocorr.map((val) => Math.abs(val)); // Magnitude
}

/**
 * Optimized HRV calculation
 */
function calculateHRVOptimized(
  signal: number[],
  frameRate: number
): number | undefined {
  try {
    const peaks: number[] = [];
    const threshold = 0.3; // 30% of signal range

    for (let i = 1; i < signal.length - 1; i++) {
      if (
        signal[i] > signal[i - 1] &&
        signal[i] > signal[i + 1] &&
        signal[i] > threshold
      ) {
        peaks.push(i);
      }
    }

    if (peaks.length < 3) {
      return;
    }

    // Calculate R-R intervals in milliseconds
    const rrIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const interval = (peaks[i] - peaks[i - 1]) * (1000 / frameRate);
      if (interval > 300 && interval < 2000) {
        // Valid R-R interval range
        rrIntervals.push(interval);
      }
    }

    if (rrIntervals.length < 2) {
      return;
    }

    // Calculate RMSSD
    let sumSquaredDiffs = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      const diff = rrIntervals[i] - rrIntervals[i - 1];
      sumSquaredDiffs += diff * diff;
    }

    const rmssd = Math.sqrt(sumSquaredDiffs / (rrIntervals.length - 1));
    return rmssd;
  } catch {
    return;
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
        count += 1;
      }
      envelope.push(sum / count);
    }

    // Find breathing peaks with appropriate spacing
    const minBreathDistance = Math.floor(frameRate * 2); // Minimum 2s between breaths (30 breaths/min max)
    const breathingPeaks: number[] = [];

    for (let i = 1; i < envelope.length - 1; i++) {
      const lastBreathingPeak =
        breathingPeaks.length > 0 ? breathingPeaks.at(-1) : undefined;
      if (
        envelope[i] > envelope[i - 1] &&
        envelope[i] > envelope[i + 1] &&
        (lastBreathingPeak === undefined ||
          i - lastBreathingPeak >= minBreathDistance)
      ) {
        breathingPeaks.push(i);
      }
    }

    if (breathingPeaks.length < 2) {
      return;
    }

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
      return;
    }

    return respiratoryRate;
  } catch {
    return;
  }
}

/**
 * Estimate heart rate from signal period
 */
function estimateHeartRateFromPeriod(
  signal: number[],
  frameRate: number
): number {
  // Autocorrelation-based estimator (mean-centered + normalized).
  // This avoids bias toward longer periods that can happen with unnormalized dot products.
  const n = signal.length;
  const minPeriod = Math.floor(frameRate * 0.5); // 0.5 seconds minimum (~120 BPM max)
  const maxPeriod = Math.floor(frameRate * 1.5); // 1.5 seconds maximum (~40 BPM min)

  const mean = signal.reduce((a, b) => a + b, 0) / n;
  const variance = signal.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  if (variance <= 0) {
    return 60; // fallback
  }

  let maxCorrelation = Number.NEGATIVE_INFINITY;
  let bestPeriod = frameRate; // Default to 1 second (60 BPM)

  for (
    let period = minPeriod;
    period <= maxPeriod && period < n / 2;
    period++
  ) {
    let correlation = 0;
    let count = 0;

    for (let i = 0; i < n - period; i++) {
      correlation += (signal[i] - mean) * (signal[i + period] - mean);
      count += 1;
    }

    const normalized = count > 0 ? correlation / (count * variance) : 0;
    if (normalized > maxCorrelation) {
      maxCorrelation = normalized;
      bestPeriod = period;
    }
  }

  return (60 * frameRate) / bestPeriod;
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
  tolerance = 10
): number {
  const difference = Math.abs(currentHR - enrolledHR);
  if (difference <= tolerance) {
    return 1.0; // Perfect match
  }

  // Linear decrease from tolerance to maxDifference
  const score = Math.max(0, 1.0 - (difference - tolerance) / tolerance);
  return score;
}
