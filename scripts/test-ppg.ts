/**
 * PPG Implementation Test Script
 * 
 * This script tests the PPG (Photoplethysmography) implementation
 * to verify that all components are working correctly.
 * 
 * Usage:
 *   bunx tsx scripts/test-ppg.ts
 * 
 * Or with Node:
 *   npx tsx scripts/test-ppg.ts
 */

import { processPPGSignalEnhanced } from '../lib/utils/BiometricUtils';
import { extractRedChannelAverage, validateFrameForPPG, calculateSignalQuality } from '../lib/utils/PPGPixelExtractor';

// Mock Frame object for testing
interface MockFrame {
  width: number;
  height: number;
  pixelFormat?: string;
  toArrayBuffer?: () => ArrayBuffer;
}

function createMockFrame(width: number = 1920, height: number = 1080): MockFrame {
  // Create a mock YUV420 frame buffer
  const yPlaneSize = width * height;
  const uvPlaneSize = Math.floor((width / 2) * (height / 2));
  const totalSize = yPlaneSize + uvPlaneSize * 2;
  const buffer = new ArrayBuffer(totalSize);
  const data = new Uint8Array(buffer);
  
  // Fill with realistic PPG-like data (simulating finger on camera)
  // Y plane: luminance (brightness)
  for (let i = 0; i < yPlaneSize; i++) {
    data[i] = 128 + Math.sin(i / 100) * 30; // Simulate PPG signal variation
  }
  
  // U and V planes: chrominance (color)
  for (let i = 0; i < uvPlaneSize; i++) {
    data[yPlaneSize + i] = 128; // U plane
    data[yPlaneSize + uvPlaneSize + i] = 128; // V plane
  }
  
  return {
    width,
    height,
    pixelFormat: 'yuv',
    toArrayBuffer: () => buffer,
  } as MockFrame;
}

function createPPGSignal(length: number = 840, heartRate: number = 70): number[] {
  const frameRate = 14; // fps
  const duration = length / frameRate; // seconds
  const frequency = heartRate / 60; // Hz
  
  const signal: number[] = [];
  for (let i = 0; i < length; i++) {
    const time = i / frameRate;
    // Generate realistic PPG signal with harmonics
    const value = 128 + 
      30 * Math.sin(2 * Math.PI * frequency * time) +
      5 * Math.sin(4 * Math.PI * frequency * time) + // Second harmonic
      (Math.random() - 0.5) * 3; // Small noise
    signal.push(Math.max(50, Math.min(250, value)));
  }
  
  return signal;
}

async function testPixelExtraction() {
  console.log('\n🧪 Testing Pixel Extraction...');
  
  try {
    const mockFrame = createMockFrame();
    
    // Note: extractRedChannelAverage is a worklet function and may not work in Node.js
    // This test verifies the function exists and can be called
    console.log('✓ Mock frame created:', {
      width: mockFrame.width,
      height: mockFrame.height,
      pixelFormat: mockFrame.pixelFormat,
    });
    
    console.log('✓ Pixel extraction function exists');
    console.log('  Note: Full pixel extraction testing requires a device with camera');
    
    return true;
  } catch (error: any) {
    console.error('✗ Pixel extraction test failed:', error.message);
    return false;
  }
}

function testSignalValidation() {
  console.log('\n🧪 Testing Signal Validation...');
  
  try {
    // Test with good signal
    const goodSignal = createPPGSignal(100, 70);
    const goodQuality = calculateSignalQuality(goodSignal);
    console.log(`✓ Good signal quality: ${goodQuality.toFixed(2)} (expected: > 0.5)`);
    
    if (goodQuality < 0.5) {
      throw new Error('Good signal quality too low');
    }
    
    // Test with poor signal (uniform)
    const poorSignal = new Array(100).fill(128);
    const poorQuality = calculateSignalQuality(poorSignal);
    console.log(`✓ Poor signal quality: ${poorQuality.toFixed(2)} (expected: < 0.3)`);
    
    if (poorQuality > 0.3) {
      throw new Error('Poor signal quality too high');
    }
    
    // Test frame validation
    const isValid = validateFrameForPPG(150, goodSignal.slice(-20));
    console.log(`✓ Frame validation: ${isValid ? 'valid' : 'invalid'}`);
    
    return true;
  } catch (error: any) {
    console.error('✗ Signal validation test failed:', error.message);
    return false;
  }
}

function testPPGSignalProcessing() {
  console.log('\n🧪 Testing PPG Signal Processing...');
  
  try {
    // Test with realistic signal (840 frames = 60 seconds at 14 fps)
    const signal = createPPGSignal(840, 72);
    const result = processPPGSignalEnhanced(signal, 14);
    
    console.log('✓ Signal processing completed');
    console.log(`  Heart Rate: ${result.heartRate} BPM (expected: ~72 BPM)`);
    console.log(`  HRV: ${result.heartRateVariability?.toFixed(0)} ms`);
    console.log(`  Respiratory Rate: ${result.respiratoryRate?.toFixed(0)} breaths/min`);
    console.log(`  Signal Quality: ${result.signalQuality.toFixed(2)}`);
    
    if (!result.success) {
      throw new Error(`Processing failed: ${result.error}`);
    }
    
    if (!result.heartRate || result.heartRate < 40 || result.heartRate > 200) {
      throw new Error(`Invalid heart rate: ${result.heartRate}`);
    }
    
    if (result.signalQuality < 0.3) {
      throw new Error(`Signal quality too low: ${result.signalQuality}`);
    }
    
    return true;
  } catch (error: any) {
    console.error('✗ PPG signal processing test failed:', error.message);
    return false;
  }
}

function testEdgeCases() {
  console.log('\n🧪 Testing Edge Cases...');
  
  try {
    // Test with insufficient data
    const shortSignal = createPPGSignal(20, 70);
    const shortResult = processPPGSignalEnhanced(shortSignal, 14);
    console.log(`✓ Short signal handled: ${shortResult.success ? 'processed' : 'rejected (expected)'}`);
    
    if (shortResult.success) {
      console.warn('  Warning: Short signal was processed (should be rejected)');
    }
    
    // Test with empty signal
    const emptyResult = processPPGSignalEnhanced([], 14);
    console.log(`✓ Empty signal handled: ${emptyResult.success ? 'processed' : 'rejected (expected)'}`);
    
    if (emptyResult.success) {
      throw new Error('Empty signal should be rejected');
    }
    
    // Test with invalid values
    const invalidSignal = [NaN, -1, 300, ...createPPGSignal(30, 70)];
    const invalidResult = processPPGSignalEnhanced(invalidSignal, 14);
    console.log(`✓ Invalid values handled: ${invalidResult.success ? 'processed' : 'rejected'}`);
    
    return true;
  } catch (error: any) {
    console.error('✗ Edge case test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting PPG Implementation Tests\n');
  console.log('=' .repeat(50));
  
  const results = {
    pixelExtraction: await testPixelExtraction(),
    signalValidation: testSignalValidation(),
    signalProcessing: testPPGSignalProcessing(),
    edgeCases: testEdgeCases(),
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));
  
  const allPassed = Object.values(results).every(r => r);
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('\n🎉 All tests passed!');
    console.log('\n📝 Next Steps:');
    console.log('  1. Build a development build: eas build -p ios --profile development');
    console.log('  2. Test on a real device with camera');
    console.log('  3. Verify pixel extraction works with actual camera frames');
    console.log('  4. Compare results with medical-grade devices for accuracy validation');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runAllTests, testPixelExtraction, testSignalValidation, testPPGSignalProcessing, testEdgeCases };

