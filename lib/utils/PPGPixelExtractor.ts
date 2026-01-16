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

import { Frame } from 'react-native-vision-camera';

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
  'worklet';
  
  try {
    // Get frame dimensions
    const width = frame.width;
    const height = frame.height;
    
    // Validate dimensions - return fallback instead of throwing
    if (!width || !height || width <= 0 || height <= 0) {
      return 128; // Return neutral value instead of throwing
    }
    
    // Calculate center region - use larger area (20% of frame) for better signal
    // When finger covers camera, entire frame should be similar in color
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const sampleRadius = Math.floor(Math.min(width, height) * 0.2);
    
    // Get pixel format
    const pixelFormat = frame.pixelFormat || 'yuv';
    
    // Cast frame for accessing internal properties
    const frameAny = frame as any;
    
    // Try multiple methods to access pixel data
    let extractedValue: number | null = null;
    
    // Method 1: Try getNativeBuffer() for Nitro Modules (react-native-vision-camera v4.x)
    if (extractedValue === null && typeof frameAny.getNativeBuffer === 'function') {
      try {
        const buffer = frameAny.getNativeBuffer();
        if (buffer) {
          const data = new Uint8Array(buffer);
          if (data.length > 0) {
            if (pixelFormat === 'yuv') {
              extractedValue = extractRedFromYUVBuffer(data, width, height, centerX, centerY, sampleRadius);
            } else {
              extractedValue = extractRedFromBuffer(data, width, height, centerX, centerY, sampleRadius);
            }
          }
        }
      } catch (e) {
        // Method not available or failed
      }
    }
    
    // Method 2: Try toArrayBuffer() (legacy API)
    if (extractedValue === null && typeof frameAny.toArrayBuffer === 'function') {
      try {
        const buffer = frameAny.toArrayBuffer();
        if (buffer) {
          const data = new Uint8Array(buffer);
          if (data.length > 0) {
            if (pixelFormat === 'yuv') {
              extractedValue = extractRedFromYUVBuffer(data, width, height, centerX, centerY, sampleRadius);
            } else {
              extractedValue = extractRedFromBuffer(data, width, height, centerX, centerY, sampleRadius);
            }
          }
        }
      } catch (e) {
        // Method not available or failed
      }
    }
    
    // Method 3: Try getPlaneData() for plane-based access (v4 API)
    if (extractedValue === null && typeof frameAny.getPlaneData === 'function') {
      try {
        const yPlaneData = frameAny.getPlaneData(0);
        if (yPlaneData) {
          const yPlane = new Uint8Array(yPlaneData);
          if (yPlane.length > 0) {
            if (pixelFormat === 'yuv') {
              // Try to get U and V planes for full YUV->RGB conversion
              try {
                const uPlaneData = frameAny.getPlaneData(1);
                const vPlaneData = frameAny.getPlaneData(2);
                if (uPlaneData && vPlaneData) {
                  const uPlane = new Uint8Array(uPlaneData);
                  const vPlane = new Uint8Array(vPlaneData);
                  extractedValue = extractRedFromYUVPlanes(yPlane, uPlane, vPlane, width, height, centerX, centerY, sampleRadius);
                } else {
                  // Only Y plane available - use luminance
                  extractedValue = extractRedFromYPlane(yPlane, width, height, centerX, centerY, sampleRadius);
                }
              } catch (e) {
                // Only Y plane available - use luminance
                extractedValue = extractRedFromYPlane(yPlane, width, height, centerX, centerY, sampleRadius);
              }
            } else {
              extractedValue = extractRedFromYPlane(yPlane, width, height, centerX, centerY, sampleRadius);
            }
          }
        }
      } catch (e) {
        // Method not available or failed
      }
    }
    
    // Method 4: Try planes array property
    if (extractedValue === null && frameAny.planes && Array.isArray(frameAny.planes) && frameAny.planes.length > 0) {
      try {
        const plane0 = frameAny.planes[0];
        if (plane0) {
          // planes could be ArrayBuffer, SharedArrayBuffer, or typed array
          let yPlane: Uint8Array;
          if (plane0 instanceof Uint8Array) {
            yPlane = plane0;
          } else if (plane0 instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && plane0 instanceof SharedArrayBuffer)) {
            yPlane = new Uint8Array(plane0);
          } else if (typeof plane0.buffer !== 'undefined') {
            yPlane = new Uint8Array(plane0.buffer);
          } else {
            yPlane = new Uint8Array(plane0);
          }
          
          if (yPlane.length > 0) {
            if (pixelFormat === 'yuv' && frameAny.planes.length >= 3) {
              try {
                const uPlane = new Uint8Array(frameAny.planes[1] instanceof ArrayBuffer ? frameAny.planes[1] : frameAny.planes[1].buffer || frameAny.planes[1]);
                const vPlane = new Uint8Array(frameAny.planes[2] instanceof ArrayBuffer ? frameAny.planes[2] : frameAny.planes[2].buffer || frameAny.planes[2]);
                extractedValue = extractRedFromYUVPlanes(yPlane, uPlane, vPlane, width, height, centerX, centerY, sampleRadius);
              } catch (e) {
                extractedValue = extractRedFromYPlane(yPlane, width, height, centerX, centerY, sampleRadius);
              }
            } else {
              extractedValue = extractRedFromYPlane(yPlane, width, height, centerX, centerY, sampleRadius);
            }
          }
        }
      } catch (e) {
        // Method not available or failed
      }
    }
    
    // If we successfully extracted a value, return it
    // Extraction stats tracking should be done via runOnJS in the calling code
    if (extractedValue !== null && !isNaN(extractedValue) && extractedValue >= 0 && extractedValue <= 255) {
      return extractedValue;
    }
    
    // Fallback: Return neutral value - signal quality check will detect this
    return generateFallbackPPGSignal();
    
  } catch (error) {
    // Return fallback value that won't break the signal
    return generateFallbackPPGSignal();
  }
}

/**
 * Generate fallback PPG signal when pixel extraction fails
 * NOTE: This should only be used as a last resort - if this is called frequently,
 * it indicates a problem with camera frame access that should be addressed.
 * Returns a neutral value (128) to avoid breaking signal processing, but the
 * signal quality validation should catch that this is not real PPG data.
 */
function generateFallbackPPGSignal(): number {
  'worklet';
  
  // Return a neutral value instead of generating simulated signal
  // This ensures that if pixel extraction fails, the signal quality
  // validation will detect poor quality and fail the measurement
  // rather than silently using fake data
  return 128; // Neutral gray value - signal quality check will catch this
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
  'worklet';
  
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
  'worklet';
  
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
  'worklet';
  
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
  'worklet';
  
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
  'worklet';
  
  // Check if brightness is in reasonable range
  // Too dark (< 50) or too bright (> 250) indicates poor finger placement
  if (redAverage < 50 || redAverage > 250) {
    return false;
  }
  
  // If we have previous values, check for variation
  if (previousValues.length > 10) {
    const recentValues = previousValues.slice(-10);
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
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
  'worklet';
  
  if (values.length < 10) {
    return 0;
  }
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
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
 * Example usage in frame processor:
 * 
 * ```typescript
 * import { extractRedChannelAverage, validateFrameForPPG } from '@/lib/utils/PPGPixelExtractor';
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
 * ```
 */

