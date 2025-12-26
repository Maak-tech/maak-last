/**
 * PPG (Photoplethysmography) Frame Processor
 * Real-time pixel analysis for heart rate measurement using react-native-vision-camera
 * 
 * Based on research:
 * - Olugbenle et al. (arXiv:2412.07082v1) - Low frame-rate PPG heart rate measurement
 * - Uses red channel intensity changes to detect blood volume variations
 */

import { Frame } from 'react-native-vision-camera';

export interface PPGFrameData {
  redAverage: number;
  timestamp: number;
  frameIndex: number;
}

/**
 * Process a camera frame to extract PPG signal
 * This runs on the worklet thread for maximum performance
 * 
 * @param frame - Camera frame from react-native-vision-camera
 * @param frameIndex - Current frame number
 * @returns PPG data containing red channel average
 */
export function processPPGFrame(frame: Frame, frameIndex: number): PPGFrameData {
  'worklet';
  
  const timestamp = Date.now();
  
  // For PPG, we need to analyze the red channel of pixels
  // Blood volume changes cause variations in red light absorption
  
  // Get frame dimensions
  const width = frame.width;
  const height = frame.height;
  
  // Calculate center region (10% of frame size)
  // We sample from the center where the finger should be
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const sampleRadius = Math.floor(Math.min(width, height) * 0.1);
  
  // Sample pixels in a grid pattern for efficiency
  // We don't need every pixel - sampling is faster and sufficient
  const sampleStep = 4; // Sample every 4th pixel
  let redSum = 0;
  let sampleCount = 0;
  
  // Get pixel data from the frame
  // Note: The exact method depends on the frame format
  // react-native-vision-camera provides different methods based on platform
  try {
    // Sample pixels in the center region
    for (let y = centerY - sampleRadius; y < centerY + sampleRadius; y += sampleStep) {
      for (let x = centerX - sampleRadius; x < centerX + sampleRadius; x += sampleStep) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          // Get pixel at (x, y)
          // For RGB format: [R, G, B, R, G, B, ...]
          // We need to extract the red channel
          const pixelIndex = (y * width + x) * 3; // Assuming RGB format
          
          // Extract red channel value (0-255)
          // This will be implemented using frame.toArrayBuffer() or similar
          // For now, we'll use a placeholder that will be replaced with actual implementation
          const redValue = extractRedChannel(frame, x, y);
          
          redSum += redValue;
          sampleCount++;
        }
      }
    }
    
    // Calculate average red intensity
    const redAverage = sampleCount > 0 ? redSum / sampleCount : 128;
    
    return {
      redAverage,
      timestamp,
      frameIndex,
    };
  } catch (error) {
    // If frame processing fails, return a default value
    // This prevents crashes but the signal quality will be poor
    return {
      redAverage: 128,
      timestamp,
      frameIndex,
    };
  }
}

/**
 * Extract red channel value from a specific pixel
 * This is a helper function that will be implemented based on the frame format
 * 
 * @param frame - Camera frame
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Red channel value (0-255)
 */
function extractRedChannel(frame: Frame, x: number, y: number): number {
  'worklet';
  
  // This is a placeholder implementation
  // The actual implementation depends on how react-native-vision-camera
  // provides pixel data access
  
  // For now, return a default value
  // This will be replaced with actual pixel extraction
  return 128;
}

/**
 * Validate if the frame has sufficient quality for PPG
 * Checks brightness, contrast, and other quality metrics
 * 
 * @param frameData - PPG frame data
 * @param previousFrames - Array of previous frame data for comparison
 * @returns true if frame quality is sufficient
 */
export function validateFrameQuality(
  frameData: PPGFrameData,
  previousFrames: PPGFrameData[]
): boolean {
  'worklet';
  
  // Check if red average is in a reasonable range
  // Too dark (< 50) or too bright (> 250) indicates poor finger placement
  if (frameData.redAverage < 50 || frameData.redAverage > 250) {
    return false;
  }
  
  // If we have previous frames, check for variation
  if (previousFrames.length > 10) {
    const recentFrames = previousFrames.slice(-10);
    const values = recentFrames.map(f => f.redAverage);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Signal should have some variation (stdDev > 1) but not too much noise (stdDev < 50)
    if (stdDev < 1 || stdDev > 50) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calculate signal quality score from frame data
 * Returns a value between 0 and 1
 * 
 * @param frames - Array of PPG frame data
 * @returns Quality score (0-1)
 */
export function calculateFrameSignalQuality(frames: PPGFrameData[]): number {
  'worklet';
  
  if (frames.length < 10) {
    return 0;
  }
  
  const values = frames.map(f => f.redAverage);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Good signal should have:
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

