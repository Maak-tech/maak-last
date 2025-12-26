/**
 * PPG Pixel Extractor for react-native-vision-camera
 * 
 * This module provides utilities to extract red channel pixel data
 * from camera frames for PPG (photoplethysmography) analysis.
 * 
 * IMPORTANT: This requires react-native-vision-camera with frame processors enabled.
 * You must be running a development build (not Expo Go).
 */

import { Frame } from 'react-native-vision-camera';

/**
 * Extract red channel average from camera frame
 * This is the core function for PPG signal extraction
 * 
 * @param frame - Camera frame from react-native-vision-camera
 * @returns Average red channel intensity (0-255)
 */
export function extractRedChannelAverage(frame: Frame): number {
  'worklet';
  
  try {
    // Get frame dimensions
    const width = frame.width;
    const height = frame.height;
    
    // Calculate center region (10% of frame size)
    // We sample from the center where the finger should be
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const sampleRadius = Math.floor(Math.min(width, height) * 0.1);
    
    // TODO: Implement actual pixel extraction
    // The method depends on the frame format (RGB, YUV, etc.)
    
    // Option 1: Using toArrayBuffer() (if available in your version)
    // const buffer = frame.toArrayBuffer();
    // const data = new Uint8Array(buffer);
    // return extractRedFromBuffer(data, width, height, centerX, centerY, sampleRadius);
    
    // Option 2: Using getNativeBuffer() (platform-specific)
    // const buffer = frame.getNativeBuffer();
    // return extractRedFromNativeBuffer(buffer, width, height, centerX, centerY, sampleRadius);
    
    // Option 3: Using a native frame processor plugin (best performance)
    // This requires creating a native module
    // See: https://react-native-vision-camera.com/docs/guides/frame-processors-plugins-overview
    
    // Placeholder: Return a default value
    // Replace this with actual pixel extraction
    return 128;
    
  } catch (error) {
    // If extraction fails, return default value
    return 128;
  }
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
 * Extract red channel from YUV buffer
 * YUV is the most common format for camera frames
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
  const sampleStep = 4;
  
  // YUV format: Y plane (luminance), then U and V planes (chrominance)
  const yPlaneSize = width * height;
  const uvPlaneSize = (width * height) / 4; // Assuming 4:2:0 subsampling
  
  for (let y = centerY - radius; y < centerY + radius; y += sampleStep) {
    for (let x = centerX - radius; x < centerX + radius; x += sampleStep) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        // Get Y, U, V values
        const yIndex = y * width + x;
        const uvIndex = Math.floor(y / 2) * Math.floor(width / 2) + Math.floor(x / 2);
        
        const Y = data[yIndex];
        const U = data[yPlaneSize + uvIndex];
        const V = data[yPlaneSize + uvPlaneSize + uvIndex];
        
        // Convert YUV to RGB
        // Standard ITU-R BT.601 conversion
        const r = Y + 1.402 * (V - 128);
        const g = Y - 0.344136 * (U - 128) - 0.714136 * (V - 128);
        const b = Y + 1.772 * (U - 128);
        
        // Clamp to 0-255 range
        const redValue = Math.max(0, Math.min(255, r));
        
        redSum += redValue;
        sampleCount++;
      }
    }
  }
  
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

