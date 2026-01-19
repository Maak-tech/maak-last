/**
 * Test script for Health Events functionality
 * Run with: npx tsx scripts/test-health-events.ts
 */

import { createVitalAlertEvent } from "../src/health/events/createHealthEvent";
import { getUserHealthEvents } from "../src/health/events/healthEventsService";
import { evaluateVitals } from "../src/health/rules/evaluateVitals";

async function testHealthEvents() {
  console.log("🧪 Testing Health Events Pipeline...\n");

  // Test 1: Normal vitals
  console.log("Test 1: Normal vitals evaluation");
  const normalVitals = {
    heartRate: 75,
    spo2: 98,
    systolic: 120,
    diastolic: 80,
    temp: 36.8,
    timestamp: new Date(),
  };

  const normalEvaluation = evaluateVitals(normalVitals);
  console.log("Normal vitals result:", normalEvaluation);
  console.log("Should require event:", false);
  console.log("");

  // Test 2: Abnormal vitals
  console.log("Test 2: Abnormal vitals evaluation");
  const abnormalVitals = {
    heartRate: 120,
    spo2: 92,
    systolic: 160,
    diastolic: 95,
    temp: 38.5,
    timestamp: new Date(),
  };

  const abnormalEvaluation = evaluateVitals(abnormalVitals);
  console.log("Abnormal vitals result:", abnormalEvaluation);
  console.log("Should require event:", true);
  console.log("");

  // Test 3: Critical vitals
  console.log("Test 3: Critical vitals evaluation");
  const criticalVitals = {
    heartRate: 45,
    spo2: 85,
    systolic: 180,
    diastolic: 110,
    temp: 39.8,
    timestamp: new Date(),
  };

  const criticalEvaluation = evaluateVitals(criticalVitals);
  console.log("Critical vitals result:", criticalEvaluation);
  console.log("Should require event:", true);
  console.log("");

  // Test 4: Create health event (mock user)
  console.log("Test 4: Creating health event");
  try {
    const mockUserId = "test-user-123";
    const eventId = await createVitalAlertEvent(
      mockUserId,
      abnormalEvaluation,
      abnormalVitals,
      "wearable"
    );

    if (eventId) {
      console.log("✅ Health event created with ID:", eventId);
    } else {
      console.log("ℹ️ No health event created (normal vitals)");
    }
  } catch (error) {
    console.log("❌ Failed to create health event:", error);
  }
  console.log("");

  // Test 5: Fetch health events
  console.log("Test 5: Fetching health events");
  try {
    const mockUserId = "test-user-123";
    const events = await getUserHealthEvents(mockUserId, 10);
    console.log(`Found ${events.length} health events:`);
    events.forEach((event, index) => {
      console.log(
        `  ${index + 1}. ${event.type} - ${event.severity} - ${event.status}`
      );
    });
  } catch (error) {
    console.log("❌ Failed to fetch health events:", error);
  }
  console.log("");

  console.log("🎉 Health Events testing complete!");
}

// Run the tests
testHealthEvents().catch(console.error);
