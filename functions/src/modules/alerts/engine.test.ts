/**
 * Alert Engine Tests
 * Uses Node assert + firebase-functions-test
 */

import * as assert from "assert";
import {
  type Alert,
  checkVitalBenchmark,
  createAlertMessage,
  getSuppressionWindow,
  shouldSuppressAlert,
  VITAL_BENCHMARKS,
  type VitalType,
} from "./engine";

// ============================================================================
// Test: Normal Readings => No Alert
// ============================================================================

console.log("\n🧪 Testing: Normal readings => No alert");

function testNormalReadings() {
  // Heart rate in normal range
  const result1 = checkVitalBenchmark("heartRate", 75);
  assert.strictEqual(
    result1.isAlert,
    false,
    "Normal heart rate should not alert"
  );
  assert.strictEqual(result1.severity, null);
  assert.strictEqual(result1.direction, null);

  // Oxygen saturation in normal range
  const result2 = checkVitalBenchmark("oxygenSaturation", 98);
  assert.strictEqual(result2.isAlert, false, "Normal SpO2 should not alert");

  // Body temperature in normal range
  const result3 = checkVitalBenchmark("bodyTemperature", 36.8);
  assert.strictEqual(
    result3.isAlert,
    false,
    "Normal temperature should not alert"
  );

  console.log("✅ Normal readings correctly produce no alerts");
}

testNormalReadings();

// ============================================================================
// Test: Warning Thresholds => Warning Alert
// ============================================================================

console.log("\n🧪 Testing: Warning threshold => Warning alert");

function testWarningThresholds() {
  // Heart rate low warning
  const result1 = checkVitalBenchmark("heartRate", 50);
  assert.strictEqual(result1.isAlert, true, "Low HR should alert");
  assert.strictEqual(result1.severity, "warning", "Should be warning severity");
  assert.strictEqual(result1.direction, "low", "Should indicate low direction");

  // Heart rate high warning
  const result2 = checkVitalBenchmark("heartRate", 120);
  assert.strictEqual(result2.isAlert, true, "High HR should alert");
  assert.strictEqual(result2.severity, "warning", "Should be warning severity");
  assert.strictEqual(
    result2.direction,
    "high",
    "Should indicate high direction"
  );

  // Oxygen saturation low warning
  const result3 = checkVitalBenchmark("oxygenSaturation", 92);
  assert.strictEqual(result3.isAlert, true, "Low SpO2 should alert");
  assert.strictEqual(result3.severity, "warning");
  assert.strictEqual(result3.direction, "low");

  // Temperature high warning
  const result4 = checkVitalBenchmark("bodyTemperature", 38.0);
  assert.strictEqual(result4.isAlert, true, "High temp should alert");
  assert.strictEqual(result4.severity, "warning");
  assert.strictEqual(result4.direction, "high");

  console.log("✅ Warning thresholds correctly produce warning alerts");
}

testWarningThresholds();

// ============================================================================
// Test: Critical Thresholds => Critical Alert
// ============================================================================

console.log("\n🧪 Testing: Critical threshold => Critical alert");

function testCriticalThresholds() {
  // Heart rate critically low
  const result1 = checkVitalBenchmark("heartRate", 40);
  assert.strictEqual(result1.isAlert, true, "Critical low HR should alert");
  assert.strictEqual(
    result1.severity,
    "critical",
    "Should be critical severity"
  );
  assert.strictEqual(result1.direction, "low");

  // Heart rate critically high
  const result2 = checkVitalBenchmark("heartRate", 150);
  assert.strictEqual(result2.isAlert, true, "Critical high HR should alert");
  assert.strictEqual(
    result2.severity,
    "critical",
    "Should be critical severity"
  );
  assert.strictEqual(result2.direction, "high");

  // Oxygen saturation critically low
  const result3 = checkVitalBenchmark("oxygenSaturation", 88);
  assert.strictEqual(result3.isAlert, true, "Critical low SpO2 should alert");
  assert.strictEqual(result3.severity, "critical");
  assert.strictEqual(result3.direction, "low");

  // Blood pressure critically high
  const result4 = checkVitalBenchmark("bloodPressure", 180);
  assert.strictEqual(result4.isAlert, true, "Critical high BP should alert");
  assert.strictEqual(result4.severity, "critical");
  assert.strictEqual(result4.direction, "high");

  console.log("✅ Critical thresholds correctly produce critical alerts");
}

testCriticalThresholds();

// ============================================================================
// Test: Duplicate Suppression Window
// ============================================================================

console.log("\n🧪 Testing: Duplicate suppression window logic");

function testDuplicateSuppression() {
  const now = Date.now();
  const userId = "user123";
  const vitalType: VitalType = "heartRate";

  // Test 1: No recent alerts - should NOT suppress
  const newAlert1 = {
    userId,
    vitalType,
    severity: "warning" as const,
    timestamp: now,
  };
  const recentAlerts1: Alert[] = [];
  const suppress1 = shouldSuppressAlert(newAlert1, recentAlerts1);
  assert.strictEqual(
    suppress1,
    false,
    "Should not suppress when no recent alerts"
  );

  // Test 2: Recent alert within window - should suppress
  const recentAlerts2: Alert[] = [
    {
      id: "alert1",
      userId,
      vitalType,
      severity: "warning",
      timestamp: now - 30 * 60 * 1000, // 30 minutes ago
    },
  ];
  const newAlert2 = {
    userId,
    vitalType,
    severity: "warning" as const,
    timestamp: now,
  };
  const suppress2 = shouldSuppressAlert(
    newAlert2,
    recentAlerts2,
    60 * 60 * 1000
  );
  assert.strictEqual(
    suppress2,
    true,
    "Should suppress duplicate within 1 hour window"
  );

  // Test 3: Old alert outside window - should NOT suppress
  const recentAlerts3: Alert[] = [
    {
      id: "alert2",
      userId,
      vitalType,
      severity: "warning",
      timestamp: now - 2 * 60 * 60 * 1000, // 2 hours ago
    },
  ];
  const newAlert3 = {
    userId,
    vitalType,
    severity: "warning" as const,
    timestamp: now,
  };
  const suppress3 = shouldSuppressAlert(
    newAlert3,
    recentAlerts3,
    60 * 60 * 1000
  );
  assert.strictEqual(
    suppress3,
    false,
    "Should not suppress old alert outside window"
  );

  // Test 4: Different severity - should NOT suppress
  const recentAlerts4: Alert[] = [
    {
      id: "alert3",
      userId,
      vitalType,
      severity: "warning",
      timestamp: now - 10 * 60 * 1000, // 10 minutes ago
    },
  ];
  const newAlert4 = {
    userId,
    vitalType,
    severity: "critical" as const,
    timestamp: now,
  };
  const suppress4 = shouldSuppressAlert(newAlert4, recentAlerts4);
  assert.strictEqual(
    suppress4,
    false,
    "Should not suppress different severity"
  );

  // Test 5: Different vital type - should NOT suppress
  const recentAlerts5: Alert[] = [
    {
      id: "alert4",
      userId,
      vitalType: "bloodPressure",
      severity: "warning",
      timestamp: now - 10 * 60 * 1000,
    },
  ];
  const newAlert5 = {
    userId,
    vitalType,
    severity: "warning" as const,
    timestamp: now,
  };
  const suppress5 = shouldSuppressAlert(newAlert5, recentAlerts5);
  assert.strictEqual(
    suppress5,
    false,
    "Should not suppress different vital type"
  );

  console.log("✅ Duplicate suppression logic works correctly");
}

testDuplicateSuppression();

// ============================================================================
// Test: Suppression Window Calculation
// ============================================================================

console.log("\n🧪 Testing: Suppression window calculation");

function testSuppressionWindow() {
  const criticalWindow = getSuppressionWindow("critical");
  assert.strictEqual(
    criticalWindow,
    30 * 60 * 1000,
    "Critical alerts: 30 min window"
  );

  const warningWindow = getSuppressionWindow("warning");
  assert.strictEqual(
    warningWindow,
    2 * 60 * 60 * 1000,
    "Warning alerts: 2 hour window"
  );

  console.log("✅ Suppression window calculation correct");
}

testSuppressionWindow();

// ============================================================================
// Test: Alert Message Creation
// ============================================================================

console.log("\n🧪 Testing: Alert message creation");

function testAlertMessages() {
  const msg1 = createAlertMessage("heartRate", 45, "bpm", "warning", "low");
  assert.strictEqual(
    msg1.title.includes("⚠️"),
    true,
    "Warning should have warning emoji"
  );
  assert.strictEqual(msg1.title.includes("Warning"), true);
  assert.strictEqual(msg1.message.includes("heart rate"), true);
  assert.strictEqual(msg1.message.includes("below"), true);
  assert.strictEqual(msg1.message.includes("45"), true);

  const msg2 = createAlertMessage(
    "oxygenSaturation",
    85,
    "%",
    "critical",
    "low"
  );
  assert.strictEqual(
    msg2.title.includes("🚨"),
    true,
    "Critical should have critical emoji"
  );
  assert.strictEqual(msg2.title.includes("Critical"), true);
  assert.strictEqual(msg2.message.includes("oxygen saturation"), true);

  console.log("✅ Alert message creation works correctly");
}

testAlertMessages();

// ============================================================================
// Test: Edge Cases
// ============================================================================

console.log("\n🧪 Testing: Edge cases");

function testEdgeCases() {
  // Exact threshold values
  const hr = VITAL_BENCHMARKS.heartRate;

  // Exactly at warning threshold (should trigger)
  const atWarningLow = checkVitalBenchmark(
    "heartRate",
    hr.alertThresholds.low.warning
  );
  assert.strictEqual(
    atWarningLow.isAlert,
    true,
    "At warning threshold should alert"
  );
  assert.strictEqual(atWarningLow.severity, "warning");

  // Exactly at critical threshold (should trigger)
  const atCriticalLow = checkVitalBenchmark(
    "heartRate",
    hr.alertThresholds.low.critical
  );
  assert.strictEqual(
    atCriticalLow.isAlert,
    true,
    "At critical threshold should alert"
  );
  assert.strictEqual(atCriticalLow.severity, "critical");

  // Just above warning threshold (should NOT trigger if in normal range)
  const justAboveWarning = checkVitalBenchmark(
    "heartRate",
    hr.alertThresholds.low.warning + 1
  );
  // This depends on normal range - if 51 is in normal range, no alert
  if (hr.normalRange.min <= 51 && hr.normalRange.max >= 51) {
    assert.strictEqual(
      justAboveWarning.isAlert,
      false,
      "Just above warning threshold in normal range"
    );
  }

  console.log("✅ Edge cases handled correctly");
}

testEdgeCases();

// ============================================================================
// Summary
// ============================================================================

console.log("\n" + "=".repeat(50));
console.log("✅ All tests passed!");
console.log("=".repeat(50) + "\n");
