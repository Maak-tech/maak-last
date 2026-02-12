/**
 * Test script for PPG processing pipeline
 * Run with: bunx tsx scripts/test-ppg.ts
 */

import {
  processPPGSignalEnhanced,
  processPPGSignalWithML,
} from "../lib/utils/BiometricUtils";

const FRAME_RATE = 14;
const DURATION_SECONDS = 20;
const TARGET_BPM = 72;

function generateSyntheticPPG(
  frameRate: number,
  durationSeconds: number,
  targetBpm: number
): number[] {
  const samples = Math.floor(frameRate * durationSeconds);
  const signal: number[] = [];
  const base = 128;
  const amplitude = 18;
  const frequencyHz = targetBpm / 60;

  for (let i = 0; i < samples; i += 1) {
    const t = i / frameRate;
    const cardiac = Math.sin(2 * Math.PI * frequencyHz * t);
    const drift = Math.sin(2 * Math.PI * 0.1 * t) * 4;
    const noise = (Math.random() - 0.5) * 6;
    const value = Math.round(base + amplitude * cardiac + drift + noise);
    signal.push(Math.max(0, Math.min(255, value)));
  }

  return signal;
}

async function run() {
  console.log("PPG test starting...");
  console.log(
    `Generating ${DURATION_SECONDS}s synthetic PPG at ${TARGET_BPM} BPM (${FRAME_RATE} fps)`
  );

  const signal = generateSyntheticPPG(FRAME_RATE, DURATION_SECONDS, TARGET_BPM);

  const enhanced = processPPGSignalEnhanced(signal, FRAME_RATE);
  console.log("Enhanced processing result:", enhanced);

  const mlFallback = await processPPGSignalWithML(signal, FRAME_RATE, false);
  console.log("ML-disabled processing result:", mlFallback);

  if (!enhanced.success) {
    throw new Error(`Enhanced processing failed: ${enhanced.error}`);
  }

  console.log("PPG test complete.");
}

run().catch((error) => {
  console.error("PPG test failed:", error);
  process.exit(1);
});
