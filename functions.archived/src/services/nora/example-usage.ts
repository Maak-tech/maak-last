/**
 * Example: How to integrate Nora AI into existing alert handlers
 *
 * This example shows how to use Nora analysis in the vital alerts trigger.
 * The same pattern can be applied to symptom alerts, fall alerts, etc.
 */
/* biome-ignore-all lint/nursery/useMaxParams: example signatures are intentionally verbose for readability. */
/* biome-ignore-all lint/suspicious/noExplicitAny: example file demonstrates integration points with broad input shapes. */
/* biome-ignore-all lint/suspicious/useAwait: async wrappers are intentionally preserved in sample flow. */
/* biome-ignore-all lint/correctness/noUnusedFunctionParameters: sample helpers keep explicit parameter lists for documentation clarity. */
/* biome-ignore-all lint/style/useDefaultSwitchClause: switch branches are intentionally explicit for documented recipient targets. */

import { createTraceId } from "../../observability/correlation";
import { logger } from "../../observability/logger";
import {
  type AlertContext,
  auditNoraAnalysis,
  executeNoraActions,
  runNoraAnalysis,
} from "./index";

/**
 * Example: Enhanced vital alert handler with Nora AI
 *
 * This replaces or augments the existing vital alert logic
 */
export async function handleVitalAlertWithNora(
  alertId: string,
  patientId: string,
  vitalType: string,
  vitalValue: number,
  severity: "info" | "warning" | "critical",
  patientAge?: number,
  medicationCount?: number
): Promise<void> {
  const traceId = createTraceId();

  logger.info("Processing vital alert with Nora", {
    traceId,
    alertId,
    patientId,
    vitalType,
    severity,
    fn: "handleVitalAlertWithNora",
  });

  try {
    // Step 1: Build alert context
    const alertContext: AlertContext = {
      alertId,
      patientId,
      alertType: "vital",
      severity,
      vitalType: vitalType as any,
      vitalValue,
      patientAge,
      medicationCount,
      timestamp: new Date(),
    };

    // Step 2: Run Nora analysis (FAIL-CLOSED: always succeeds)
    const result = await runNoraAnalysis({
      traceId,
      alertContext,
    });

    if (!(result.success && result.output)) {
      // This should never happen due to fail-closed design
      // But handle gracefully just in case
      logger.warn("Nora analysis returned no output, using standard alert", {
        traceId,
        alertId,
        fn: "handleVitalAlertWithNora",
      });

      // Fall back to standard alert handling
      await sendStandardAlert(alertId, patientId, severity);
      return;
    }

    // Step 3: Get backend actions from Nora output
    const actions = await executeNoraActions(
      result.output,
      alertContext,
      traceId
    );

    logger.info("Nora actions determined", {
      traceId,
      alertId,
      sendAlert: actions.sendAlert,
      recipientCount: actions.alertRecipients.length,
      actionCode: result.output.recommendedActionCode,
      escalationLevel: result.output.escalationLevel,
      riskScore: result.output.riskScore,
      fn: "handleVitalAlertWithNora",
    });

    // Step 4: Execute backend actions

    // 4a. Send alerts to recipients
    if (actions.sendAlert && actions.alertRecipients.length > 0) {
      await sendAlertsToRecipients(
        alertId,
        patientId,
        actions.alertRecipients,
        result.output.summary,
        result.output.escalationLevel,
        traceId
      );
    }

    // 4b. Create app CTA
    if (actions.appCTA) {
      await createAppNotification(
        patientId,
        actions.appCTA.action,
        actions.appCTA.label,
        actions.appCTA.priority,
        result.output.summary,
        traceId
      );
    }

    // 4c. Execute automated actions
    for (const autoAction of actions.autoActions) {
      await executeAutomatedAction(autoAction, alertId, patientId, traceId);
    }

    // Step 5: Audit log
    await auditNoraAnalysis(result.output, alertContext, traceId);

    logger.info("Vital alert processed successfully with Nora", {
      traceId,
      alertId,
      fn: "handleVitalAlertWithNora",
    });
  } catch (error) {
    // Even if Nora fails completely, send standard alert
    logger.error(
      "Error processing alert with Nora, falling back to standard alert",
      error as Error,
      {
        traceId,
        alertId,
        patientId,
        fn: "handleVitalAlertWithNora",
      }
    );

    await sendStandardAlert(alertId, patientId, severity);
  }
}

/**
 * Send alerts to specified recipients
 */
async function sendAlertsToRecipients(
  alertId: string,
  patientId: string,
  recipients: ("caregiver" | "family" | "emergency")[],
  summary: string,
  escalationLevel: string,
  traceId: string
): Promise<void> {
  logger.info("Sending alerts to recipients", {
    traceId,
    alertId,
    recipients,
    fn: "sendAlertsToRecipients",
  });

  for (const recipient of recipients) {
    switch (recipient) {
      case "caregiver":
        // Send push notification to caregivers
        // await sendPushNotification(...)
        logger.info("Sent alert to caregivers", { traceId, alertId });
        break;

      case "family":
        // Send push notification to family members
        // await sendPushNotification(...)
        logger.info("Sent alert to family", { traceId, alertId });
        break;

      case "emergency":
        // Trigger emergency protocol
        // This might include SMS, phone calls, etc.
        logger.info("Triggered emergency protocol", { traceId, alertId });
        break;
    }
  }
}

/**
 * Create app notification with CTA
 */
async function createAppNotification(
  patientId: string,
  action: string,
  label: string,
  priority: string,
  summary: string,
  traceId: string
): Promise<void> {
  logger.info("Creating app notification", {
    traceId,
    patientId,
    action,
    priority,
    fn: "createAppNotification",
  });

  // Create notification in Firestore
  // const db = admin.firestore();
  // await db.collection('notifications').add({
  //   patientId,
  //   title: summary,
  //   body: label,
  //   action,
  //   priority,
  //   createdAt: admin.firestore.FieldValue.serverTimestamp(),
  // });
}

/**
 * Execute automated action
 */
async function executeAutomatedAction(
  action: string,
  alertId: string,
  patientId: string,
  traceId: string
): Promise<void> {
  logger.info("Executing automated action", {
    traceId,
    alertId,
    action,
    fn: "executeAutomatedAction",
  });

  switch (action) {
    case "schedule_followup_1h":
      // Schedule follow-up check in 1 hour
      logger.info("Scheduled 1h follow-up", { traceId, alertId });
      break;

    case "schedule_followup_24h":
      // Schedule follow-up check in 24 hours
      logger.info("Scheduled 24h follow-up", { traceId, alertId });
      break;

    case "send_caregiver_notification":
      // Send push notification to caregiver
      logger.info("Sent caregiver notification", { traceId, alertId });
      break;

    case "send_family_notification":
      // Send push notification to family
      logger.info("Sent family notification", { traceId, alertId });
      break;

    case "escalate_to_emergency":
      // Escalate to emergency services
      logger.info("Escalated to emergency", { traceId, alertId });
      break;

    case "log_critical_event":
      // Log as critical event for audit
      logger.info("Logged critical event", { traceId, alertId });
      break;

    case "log_high_risk_event":
      // Log as high-risk event
      logger.info("Logged high-risk event", { traceId, alertId });
      break;

    case "log_nora_analysis":
      // Already logged in auditNoraAnalysis
      break;

    default:
      logger.warn("Unknown automated action", {
        traceId,
        action,
        fn: "executeAutomatedAction",
      });
  }
}

/**
 * Fallback: Send standard alert without Nora
 */
async function sendStandardAlert(
  alertId: string,
  patientId: string,
  severity: string
): Promise<void> {
  logger.info("Sending standard alert", {
    alertId,
    patientId,
    severity,
    fn: "sendStandardAlert",
  });

  // Use existing alert logic
  // This ensures alerts are NEVER blocked by Nora failures
}
