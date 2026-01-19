/**
 * PPG Pixel Extractor for react-native-vision-camera
 *
 * This module provides utilities to extract red channel pixel data
 * from camera frames for PPG (photoplethysmography) analysis.
 *
 * Based on research:
 * - Olugbenle et al. (arXiv:2412.07082v1) - Low frame-rate PPG heart rate measurement at 14 fps
 * - Total pixel intensity calculation for PPG signal extraction
 *
 * IMPORTANT: This requires react-native-vision-camera with frame processors enabled.
 * You must be running a development build (not Expo Go).
 */

import type { Frame } from "react-native-vision-camera";

// Debug flag - set to false in production to reduce console spam
// Set to true when troubleshooting frame extraction issues
const DEBUG_FRAME_EXTRACTION = __DEV__;

/**
 * Extract red channel average from camera frame
 * This is the core function for PPG signal extraction
 *
 * The algorithm calculates the total intensity of pixels in the center region
 * of the frame, as described in Olugbenle et al. research paper.
 *
 * NOTE: Extraction stats tracking should be done via runOnJS callbacks in the
 * calling code, not via worklet-global state, to avoid threading issues.
 *
 * @param frame - Camera frame from react-native-vision-camera
 * @returns Average red channel intensity (0-255), or -1 on extraction failure
 */
export function extractRedChannelAverage(frame: Frame): number {
  "worklet";

  try {
    // Get frame dimensions
    const width = frame.width;
    const height = frame.height;

    // Validate dimensions - return -1 (invalid) instead of fake data
    if (!(width && height) || width <= 0 || height <= 0) {
      if (DEBUG_FRAME_EXTRACTION) {
        console.log("[PPG] Frame dimensions invalid:", width, height);
      }
      return -1; // Return invalid marker - frame dimensions invalid
    }

    // Calculate center region following research guidance
    // Use larger area (25-30% of frame) for better signal averaging
    // When finger covers camera and flashlight, entire frame should be similar in color
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const sampleRadius = Math.floor(Math.min(width, height) * 0.25); // Increased to 25% for better averaging

    // Get pixel format
    const pixelFormat = frame.pixelFormat;

    // Only log frame info once (first frame)
    // Subsequent frames will use the same method

    // Cast frame for accessing internal properties (JSI HostObjects can be fragile - avoid enumerating keys)
    const frameAny = frame as any;

    // Try multiple methods to access pixel data
    let extractedValue: number | null = null;
    let extractionMethod = "none";
    let isFirstFrame = false; // Will be set by successful extraction

    // IMPORTANT:
    // This function runs inside a Frame Processor worklet. Some runtimes cannot
    // access module-scope helper functions reliably (they may be undefined).
    // Keep RGB sampling logic self-contained here to avoid "is not a function" errors.
    const sampleRGB = (data: Uint8Array, bytesPerRow: number): number => {
      // VisionCamera docs: pixelFormat="rgb" is RGBA or BGRA (8-bit) -> 4 bytes per pixel.
      // IMPORTANT: Do not average RGBA and BGRA interpretations: that can wash out the true
      // red channel (and reduce PPG amplitude/SNR), causing persistent "low quality".
      // Instead, take the stronger candidate per pixel.
      const bpp = 4;
      const stride = bytesPerRow > 0 ? bytesPerRow : width * bpp;

      const minX = Math.max(0, centerX - sampleRadius);
      const maxX = Math.min(width - 1, centerX + sampleRadius);
      const minY = Math.max(0, centerY - sampleRadius);
      const maxY = Math.min(height - 1, centerY + sampleRadius);

      let sum = 0;
      let count = 0;
      const step = 4;

      for (let y = minY; y <= maxY; y += step) {
        const rowStart = y * stride;
        for (let x = minX; x <= maxX; x += step) {
          const idx = rowStart + x * bpp;
          if (idx + 3 >= data.length) continue;

          // BGRA: [B, G, R, A] -> red at +2
          const redBGRA = data[idx + 2];
          // RGBA: [R, G, B, A] -> red at +0
          const redRGBA = data[idx + 0];

          // Pick the stronger candidate channel per pixel.
          sum += redBGRA > redRGBA ? redBGRA : redRGBA;
          count++;
        }
      }

      return count > 0 ? sum / count : Number.NaN;
    };

    // Method 1: Try toArrayBuffer()
    if (
      extractedValue === null &&
      typeof frameAny.toArrayBuffer === "function"
    ) {
      try {
        const buffer = frameAny.toArrayBuffer();
        if (buffer) {
          // buffer can be ArrayBuffer (expected). If it's not, this will throw and get logged below.
          const data = new Uint8Array(buffer);
          if (data.length > 0) {
            if (pixelFormat === "yuv") {
              extractedValue = extractRedFromYUVBuffer(
                data,
                width,
                height,
                centerX,
                centerY,
                sampleRadius
              );
            } else {
              extractedValue = sampleRGB(data, frame.bytesPerRow);
            }
            extractionMethod = "toArrayBuffer";
            isFirstFrame = true;
          }
        }
      } catch (e) {
        if (DEBUG_FRAME_EXTRACTION) {
          console.log("[PPG] toArrayBuffer() threw:", String(e));
        }
        // Method not available or failed - try next method
      }
    }

    // Method 2: Try getPlaneData() (some builds expose this non-typed API)
    if (
      extractedValue === null &&
      typeof frameAny.getPlaneData === "function"
    ) {
      try {
        const yPlaneData = frameAny.getPlaneData(0);
        if (yPlaneData) {
          const yPlane = new Uint8Array(yPlaneData);
          if (yPlane.length > 0) {
            if (pixelFormat === "yuv") {
              // Try to get U and V planes for full YUV->RGB conversion
              try {
                const uPlaneData = frameAny.getPlaneData(1);
                const vPlaneData = frameAny.getPlaneData(2);
                if (uPlaneData && vPlaneData) {
                  const uPlane = new Uint8Array(uPlaneData);
                  const vPlane = new Uint8Array(vPlaneData);
                  extractedValue = extractRedFromYUVPlanes(
                    yPlane,
                    uPlane,
                    vPlane,
                    width,
                    height,
                    centerX,
                    centerY,
                    sampleRadius
                  );
                  extractionMethod = "getPlaneData-YUV";
                } else {
                  // Only Y plane available - use luminance
                  extractedValue = extractRedFromYPlane(
                    yPlane,
                    width,
                    height,
                    centerX,
                    centerY,
                    sampleRadius
                  );
                  extractionMethod = "getPlaneData-Y";
                }
              } catch (e) {
                // Only Y plane available - use luminance
                extractedValue = extractRedFromYPlane(
                  yPlane,
                  width,
                  height,
                  centerX,
                  centerY,
                  sampleRadius
                );
                extractionMethod = "getPlaneData-Y";
              }
            } else {
              extractedValue = extractRedFromYPlane(
                yPlane,
                width,
                height,
                centerX,
                centerY,
                sampleRadius
              );
              extractionMethod = "getPlaneData";
            }
            isFirstFrame = true;
          }
        }
      } catch (e) {
        // Method not available or failed - try next method
      }
    }

    // Method 3: Try planes array property (some builds expose this non-typed API)
    if (
      extractedValue === null &&
      frameAny.planes &&
      Array.isArray(frameAny.planes) &&
      frameAny.planes.length > 0
    ) {
      try {
        const plane0 = frameAny.planes[0];
        if (plane0) {
          // planes could be ArrayBuffer, SharedArrayBuffer, or typed array
          let yPlane: Uint8Array;
          if (plane0 instanceof Uint8Array) {
            yPlane = plane0;
          } else if (
            plane0 instanceof ArrayBuffer ||
            (typeof SharedArrayBuffer !== "undefined" &&
              plane0 instanceof SharedArrayBuffer)
          ) {
            yPlane = new Uint8Array(plane0);
          } else if (typeof plane0.buffer !== "undefined") {
            yPlane = new Uint8Array(plane0.buffer);
          } else {
            yPlane = new Uint8Array(plane0);
          }

          if (yPlane.length > 0) {
            if (pixelFormat === "yuv" && frameAny.planes.length >= 3) {
              try {
                const uPlane = new Uint8Array(
                  frameAny.planes[1] instanceof ArrayBuffer
                    ? frameAny.planes[1]
                    : frameAny.planes[1].buffer || frameAny.planes[1]
                );
                const vPlane = new Uint8Array(
                  frameAny.planes[2] instanceof ArrayBuffer
                    ? frameAny.planes[2]
                    : frameAny.planes[2].buffer || frameAny.planes[2]
                );
                extractedValue = extractRedFromYUVPlanes(
                  yPlane,
                  uPlane,
                  vPlane,
                  width,
                  height,
                  centerX,
                  centerY,
                  sampleRadius
                );
                extractionMethod = "planes-YUV";
              } catch (e) {
                extractedValue = extractRedFromYPlane(
                  yPlane,
                  width,
                  height,
                  centerX,
                  centerY,
                  sampleRadius
                );
                extractionMethod = "planes-Y";
              }
            } else {
              extractedValue = extractRedFromYPlane(
                yPlane,
                width,
                height,
                centerX,
                centerY,
                sampleRadius
              );
              extractionMethod = "planes";
            }
            isFirstFrame = true;
          }
        }
      } catch (e) {
        // Method not available or failed
      }
    }

    // If we successfully extracted a value, return it
    // Extraction stats tracking should be done via runOnJS in the calling code
    if (
      extractedValue !== null &&
      !isNaN(extractedValue) &&
      extractedValue >= 0 &&
      extractedValue <= 255
    ) {
      // Only log success on first frame or when debugging
      if (DEBUG_FRAME_EXTRACTION && isFirstFrame) {
        console.log("[PPG] Frame extraction working:", {
          method: extractionMethod,
          dimensions: `${width}x${height}`,
          pixelFormat,
          sampleValue: extractedValue,
        });
      }
      return extractedValue;
    }

    // All methods failed - log details only when debugging
    if (DEBUG_FRAME_EXTRACTION) {
      console.log("[PPG] All extraction methods failed");
      console.log(
        "[PPG] Frame has toArrayBuffer:",
        typeof frameAny.toArrayBuffer === "function"
      );
      console.log(
        "[PPG] Frame has getPlaneData:",
        typeof frameAny.getPlaneData === "function"
      );
      console.log("[PPG] Frame has planes:", Array.isArray(frameAny.planes));
    }

    // Fallback: Return invalid marker
    return -1;
  } catch (error) {
    if (DEBUG_FRAME_EXTRACTION) {
      console.log("[PPG] Exception during extraction:", String(error));
    }
    // Return fallback value that won't break the signal
    return -1;
  }
}

/**
 * CRITICAL: No fallback signal generation
 * When pixel extraction fails, we MUST return -1 (invalid marker)
 * to ensure the measurement properly fails rather than using fake data.
 *
 * This is essential for scientific accuracy based on:
 * - Olugbenle et al. (arXiv:2412.07082v1) - Real PPG signals required
 * - PMC5981424 - Validation of smartphone PPG requires actual sensor data
 *
 * DO NOT return any value that could be mistaken for valid PPG data.
 */
function generateFallbackPPGSignal(): number {
  "worklet";

  // Return -1 as an invalid marker
  // This value will be rejected by the validation in the calling code
  // and will cause the measurement to properly fail
  // DO NOT return 128 or any other "neutral" value that could pass validation
  return -1; // Invalid marker - extraction failed
}

/**
 * Extract red channel from RGB frames in VisionCamera.
 * VisionCamera's `pixelFormat="rgb"` is documented as "RGBA or BGRA (8-bit)".
 *
 * This implementation:
 * - Assumes 4 bytes per pixel.
 * - Uses `bytesPerRow` stride to support padding.
 * - Treats the frame as BGRA (iOS) by default but also works for RGBA by sampling both and averaging.
 *
 * @returns Average red channel intensity (0-255), or NaN if sampling fails.
 */
function extractRedFromRGBAorBGRA(
  data: Uint8Array,
  width: number,
  height: number,
  bytesPerRow: number,
  centerX: number,
  centerY: number,
  radius: number
): number {
  "worklet";

  const bpp = 4;
  const stride = bytesPerRow > 0 ? bytesPerRow : width * bpp;

  const minX = Math.max(0, centerX - radius);
  const maxX = Math.min(width - 1, centerX + radius);
  const minY = Math.max(0, centerY - radius);
  const maxY = Math.min(height - 1, centerY + radius);

  let sum = 0;
  let count = 0;
  const step = 4;

  for (let y = minY; y <= maxY; y += step) {
    const rowStart = y * stride;
    for (let x = minX; x <= maxX; x += step) {
      const idx = rowStart + x * bpp;
      if (idx + 3 >= data.length) continue;

      // BGRA: [B, G, R, A] -> red at +2
      const redBGRA = data[idx + 2];
      // RGBA: [R, G, B, A] -> red at +0
      const redRGBA = data[idx + 0];

      // Average the two interpretations. One will be correct; the other will be correlated but wrong.
      // This avoids hard-coding platform branching inside the worklet.
      sum += (redBGRA + redRGBA) * 0.5;
      count++;
    }
  }

  return count > 0 ? sum / count : Number.NaN;
}

/**
 * Extract red channel from RGB buffer
 * Assumes RGB format: [R, G, B, R, G, B, ...]
 *
 * @param data - Pixel data as Uint8Array
 * @param width - Frame width
 * @param height - Frame height
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param radius - Sampling radius
 * @returns Average red channel intensity
 */
function extractRedFromBuffer(
  data: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number
): number {
  "worklet";

  let redSum = 0;
  let sampleCount = 0;
  const sampleStep = 4; // Sample every 4th pixel for efficiency

  // Sample pixels in center region
  for (let y = centerY - radius; y < centerY + radius; y += sampleStep) {
    for (let x = centerX - radius; x < centerX + radius; x += sampleStep) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        // Calculate pixel index for RGB format
        const pixelIndex = (y * width + x) * 3;

        // Extract red channel (first byte of RGB triplet)
        const redValue = data[pixelIndex];

        redSum += redValue;
        sampleCount++;
      }
    }
  }

  return sampleCount > 0 ? redSum / sampleCount : 128;
}

/**
 * Extract red channel from YUV planes (react-native-vision-camera v4 API)
 * Uses YUV420 format (4:2:0 subsampling) which is standard for most cameras
 *
 * @param yPlane - Y (luminance) plane data
 * @param uPlane - U (chrominance) plane data
 * @param vPlane - V (chrominance) plane data
 * @param width - Frame width
 * @param height - Frame height
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param radius - Sampling radius
 * @returns Average red channel intensity
 */
function extractRedFromYUVPlanes(
  yPlane: Uint8Array,
  uPlane: Uint8Array,
  vPlane: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number
): number {
  "worklet";

  let redSum = 0;
  let sampleCount = 0;
  const sampleStep = 4; // Sample every 4th pixel for performance

  // Ensure we don't go out of bounds
  const minX = Math.max(0, centerX - radius);
  const maxX = Math.min(width - 1, centerX + radius);
  const minY = Math.max(0, centerY - radius);
  const maxY = Math.min(height - 1, centerY + radius);

  // U and V planes are subsampled (half resolution)
  const uvWidth = Math.floor(width / 2);
  const uvHeight = Math.floor(height / 2);

  for (let y = minY; y <= maxY; y += sampleStep) {
    for (let x = minX; x <= maxX; x += sampleStep) {
      // Get Y (luminance) value
      const yIndex = y * width + x;
      if (yIndex >= yPlane.length) continue;

      const Y = yPlane[yIndex];

      // Get U and V (chrominance) values - subsampled at 2x2 blocks
      const uvX = Math.floor(x / 2);
      const uvY = Math.floor(y / 2);
      const uvIndex = uvY * uvWidth + uvX;

      if (uvIndex >= uPlane.length || uvIndex >= vPlane.length) continue;

      const U = uPlane[uvIndex];
      const V = vPlane[uvIndex];

      // Convert YUV to RGB using ITU-R BT.601 standard
      const r = Y + 1.402 * (V - 128);

      // Clamp to valid RGB range (0-255)
      const redValue = Math.max(0, Math.min(255, Math.round(r)));

      redSum += redValue;
      sampleCount++;
    }
  }

  // Return average red channel intensity
  return sampleCount > 0 ? redSum / sampleCount : 128;
}

/**
 * Extract red channel from Y plane only (luminance approximation)
 * Used when U/V planes are not available
 *
 * @param yPlane - Y (luminance) plane data
 * @param width - Frame width
 * @param height - Frame height
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param radius - Sampling radius
 * @returns Average luminance (approximation of red channel)
 */
function extractRedFromYPlane(
  yPlane: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number
): number {
  "worklet";

  let sum = 0;
  let sampleCount = 0;
  const sampleStep = 4; // Sample every 4th pixel for performance

  // Ensure we don't go out of bounds
  const minX = Math.max(0, centerX - radius);
  const maxX = Math.min(width - 1, centerX + radius);
  const minY = Math.max(0, centerY - radius);
  const maxY = Math.min(height - 1, centerY + radius);

  for (let y = minY; y <= maxY; y += sampleStep) {
    for (let x = minX; x <= maxX; x += sampleStep) {
      const yIndex = y * width + x;
      if (yIndex >= yPlane.length) continue;

      sum += yPlane[yIndex];
      sampleCount++;
    }
  }

  // Return average luminance (approximation of red channel)
  return sampleCount > 0 ? sum / sampleCount : 128;
}

/**
 * Extract red channel from YUV buffer (legacy API)
 * YUV is the most common format for camera frames
 * Uses YUV420 format (4:2:0 subsampling) which is standard for most cameras
 *
 * @param data - Pixel data as Uint8Array (YUV format)
 * @param width - Frame width
 * @param height - Frame height
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param radius - Sampling radius
 * @returns Average red channel intensity
 */
function extractRedFromYUVBuffer(
  data: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number
): number {
  "worklet";

  let redSum = 0;
  let sampleCount = 0;
  const sampleStep = 4; // Sample every 4th pixel for performance

  // YUV420 format layout
  const yPlaneSize = width * height;
  const uvPlaneSize = Math.floor((width / 2) * (height / 2));

  // Validate buffer size
  const expectedSize = yPlaneSize + 2 * uvPlaneSize;
  if (data.length < expectedSize) {
    // Buffer too small, return neutral value
    return 128;
  }

  // Ensure we don't go out of bounds
  const minX = Math.max(0, centerX - radius);
  const maxX = Math.min(width - 1, centerX + radius);
  const minY = Math.max(0, centerY - radius);
  const maxY = Math.min(height - 1, centerY + radius);

  for (let y = minY; y <= maxY; y += sampleStep) {
    for (let x = minX; x <= maxX; x += sampleStep) {
      // Get Y (luminance) value
      const yIndex = y * width + x;
      if (yIndex >= yPlaneSize) continue;

      const Y = data[yIndex];

      // Get U and V (chrominance) values - subsampled at 2x2 blocks
      const uvX = Math.floor(x / 2);
      const uvY = Math.floor(y / 2);
      const uvIndex = uvY * Math.floor(width / 2) + uvX;

      if (uvIndex >= uvPlaneSize) continue;

      const uIndex = yPlaneSize + uvIndex;
      const vIndex = yPlaneSize + uvPlaneSize + uvIndex;

      if (uIndex >= data.length || vIndex >= data.length) continue;

      const U = data[uIndex];
      const V = data[vIndex];

      // Convert YUV to RGB using ITU-R BT.601 standard
      const r = Y + 1.402 * (V - 128);

      // Clamp to valid RGB range (0-255)
      const redValue = Math.max(0, Math.min(255, Math.round(r)));

      redSum += redValue;
      sampleCount++;
    }
  }

  // Return average red channel intensity
  return sampleCount > 0 ? redSum / sampleCount : 128;
}

/**
 * Validate frame quality for PPG
 * Checks if the frame is suitable for heart rate measurement
 *
 * @param redAverage - Average red channel intensity
 * @param previousValues - Array of previous red channel values
 * @returns true if frame quality is good
 */
export function validateFrameForPPG(
  redAverage: number,
  previousValues: number[]
): boolean {
  "worklet";

  // Check if brightness is in reasonable range
  // Too dark (< 50) or too bright (> 250) indicates poor finger placement
  if (redAverage < 50 || redAverage > 250) {
    return false;
  }

  // If we have previous values, check for variation
  if (previousValues.length > 10) {
    const recentValues = previousValues.slice(-10);
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const variance =
      recentValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
      recentValues.length;
    const stdDev = Math.sqrt(variance);

    // Signal should have some variation (stdDev > 1) but not too much noise (stdDev < 50)
    if (stdDev < 1 || stdDev > 50) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate signal quality score
 * Returns a value between 0 and 1 indicating signal quality
 *
 * @param values - Array of red channel values
 * @returns Quality score (0-1)
 */
export function calculateSignalQuality(values: number[]): number {
  "worklet";

  if (values.length < 10) {
    return 0;
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Good signal characteristics:
  // 1. Moderate variation (stdDev between 5 and 30)
  // 2. Mean in reasonable range (100-200)
  // 3. No extreme outliers

  let quality = 1.0;

  // Penalize low variation
  if (stdDev < 5) {
    quality *= stdDev / 5;
  }

  // Penalize excessive variation (noise)
  if (stdDev > 30) {
    quality *= Math.max(0, 1 - (stdDev - 30) / 50);
  }

  // Penalize poor brightness
  if (mean < 100 || mean > 200) {
    const deviation = Math.abs(mean - 150);
    quality *= Math.max(0, 1 - deviation / 100);
  }

  return Math.max(0, Math.min(1, quality));
}

/**
 * Calculate real-time signal quality for PPG following research guidance
 * Used during measurement to provide immediate feedback on signal quality
 *
 * @param signal - Recent signal samples (last ~5 seconds)
 * @returns Quality score (0-1)
 */
export function calculateRealTimeSignalQuality(signal: number[]): number {
  "worklet";

  if (signal.length < 30) return 0;

  // Calculate basic statistics
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  const variance =
    signal.reduce((sum, val) => sum + (val - mean) ** 2, 0) / signal.length;
  const stdDev = Math.sqrt(variance);

  // Check signal range (should be reasonable for PPG)
  const min = Math.min(...signal);
  const max = Math.max(...signal);
  const range = max - min;

  // Basic quality checks
  // IMPORTANT: Smartphone PPG can have small amplitude in raw pixel averages (often 1-4 units).
  // Do not treat "range < 5" as automatically unusable; instead only reject near-flat signals.
  if (range < 1 || stdDev < 0.2) return 0.1; // Very poor / near-flat signal
  if (range > 100 || stdDev > 50) return 0.2; // Too noisy

  // Calculate SNR (Signal-to-Noise Ratio)
  const signalPower = variance;
  const noiseEstimate = estimateNoiseFromHighFreq(signal);
  const snr = noiseEstimate > 0 ? signalPower / noiseEstimate : 0;
  const snrScore = Math.min(snr / 5, 1); // SNR > 5 is good

  // Calculate periodicity using autocorrelation
  const periodicityScore = calculatePeriodicityFromAutocorr(signal);

  // Calculate stability (variation in signal characteristics over time)
  const stabilityScore = calculateSignalStability(signal);

  // Weighted quality score
  const quality =
    0.4 * snrScore + 0.4 * periodicityScore + 0.2 * stabilityScore;

  return Math.max(0, Math.min(1, quality));
}

/**
 * Estimate noise from high-frequency components
 */
function estimateNoiseFromHighFreq(signal: number[]): number {
  "worklet";

  // Simple high-pass filter to isolate noise
  const filtered: number[] = [];
  for (let i = 2; i < signal.length; i++) {
    // Second-order high-pass filter approximation
    const highFreq = signal[i] - 2 * signal[i - 1] + signal[i - 2];
    filtered.push(Math.abs(highFreq));
  }

  if (filtered.length === 0) return 0;

  const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  return mean;
}

/**
 * Calculate periodicity using autocorrelation
 */
function calculatePeriodicityFromAutocorr(signal: number[]): number {
  "worklet";

  const maxLag = Math.min(50, Math.floor(signal.length / 3));
  const autocorr: number[] = [];

  // Calculate autocorrelation
  for (let lag = 10; lag <= maxLag; lag++) {
    // Start from lag 10 to avoid DC component
    let correlation = 0;
    let count = 0;

    for (let i = lag; i < signal.length; i++) {
      correlation += signal[i] * signal[i - lag];
      count++;
    }

    autocorr.push(count > 0 ? correlation / count : 0);
  }

  if (autocorr.length === 0) return 0;

  // Find maximum correlation (excluding first few lags)
  const maxCorr = Math.max(...autocorr.slice(5));
  const meanCorr = autocorr.reduce((a, b) => a + b, 0) / autocorr.length;

  // Periodicity score based on peak correlation
  return Math.min(maxCorr / meanCorr, 1);
}

/**
 * Calculate signal stability over time
 */
function calculateSignalStability(signal: number[]): number {
  "worklet";

  // Divide into segments and check consistency
  const segmentSize = Math.floor(signal.length / 3);
  if (segmentSize < 10) return 0.5;

  const segments: number[][] = [];
  for (let i = 0; i < 3; i++) {
    const start = i * segmentSize;
    const end = Math.min((i + 1) * segmentSize, signal.length);
    segments.push(signal.slice(start, end));
  }

  // Calculate statistics for each segment
  const stats = segments.map((segment) => {
    const mean = segment.reduce((a, b) => a + b, 0) / segment.length;
    const variance =
      segment.reduce((sum, val) => sum + (val - mean) ** 2, 0) / segment.length;
    return { mean, std: Math.sqrt(variance) };
  });

  // Check consistency
  const meanMeans =
    stats.reduce((sum, stat) => sum + stat.mean, 0) / stats.length;
  const meanVariation =
    stats.reduce((sum, stat) => sum + (stat.mean - meanMeans) ** 2, 0) /
    stats.length;

  // Lower variation = higher stability
  return Math.max(0, 1 - Math.sqrt(meanVariation) / (meanMeans * 0.2));
}

/**
 * Example usage in frame processor:
 *
 * ```typescript
 * import { extractRedChannelAverage, validateFrameForPPG, calculateRealTimeSignalQuality } from '@/lib/utils/PPGPixelExtractor';
 *
 * const frameProcessor = useFrameProcessor((frame) => {
 *   'worklet';
 *
 *   // Extract red channel average
 *   const redAverage = extractRedChannelAverage(frame);
 *
 *   // Validate frame quality
 *   const isValid = validateFrameForPPG(redAverage, previousValues);
 *
 *   if (isValid) {
 *     // Process the frame
 *     runOnJS(processPPGFrameData)(redAverage, frameIndex);
 *   }
 * }, []);
 *
 * // During measurement, assess real-time quality
 * const quality = calculateRealTimeSignalQuality(recentSignal);
 * ```
 */
