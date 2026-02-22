/**
 * Medical History Firestore Trigger
 * Creates triage alerts when high-risk conditions are added.
 */

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFamilyAdmins } from "../modules/family/admins";
import { logger } from "../observability/logger";

const HIGH_RISK_CONDITION_KEYWORDS = [
  "heart failure",
  "stroke",
  "copd",
  "chronic kidney",
  "kidney disease",
  "coronary",
  "heart disease",
  "cancer",
];

const isHighRiskCondition = (condition: string): boolean => {
  const normalized = condition.toLowerCase();
  return HIGH_RISK_CONDITION_KEYWORDS.some((keyword) =>
    normalized.includes(keyword)
  );
};

const mapMedicalHistorySeverity = (
  severity: unknown,
  condition: string
): "low" | "medium" | "high" => {
  const normalizedSeverity =
    typeof severity === "string" ? severity.toLowerCase().trim() : "";

  if (isHighRiskCondition(condition)) {
    return "high";
  }
  if (normalizedSeverity === "severe") {
    return "high";
  }
  if (normalizedSeverity === "moderate") {
    return "medium";
  }
  if (normalizedSeverity === "mild") {
    return "low";
  }
  return "medium";
};

/**
 * Firestore trigger: when new medical history is created, create an in-app alert
 * so caregivers/admins can triage from the app UI.
 */
export const checkMedicalHistoryBenchmarks = onDocumentCreated(
  "medicalHistory/{historyId}",
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Trigger handles dedupe, user lookup, alert create, and optional push notify.
  async (event) => {
    const historyData = event.data?.data();
    if (!historyData) {
      return;
    }

    const userId =
      typeof historyData.userId === "string" ? historyData.userId : "";
    const condition =
      typeof historyData.condition === "string"
        ? historyData.condition.trim()
        : "";
    const isFamily = historyData.isFamily === true;

    if (!(userId && condition) || isFamily) {
      return;
    }

    const shouldTriage =
      isHighRiskCondition(condition) ||
      (typeof historyData.severity === "string" &&
        historyData.severity.toLowerCase().trim() === "severe");
    if (!shouldTriage) {
      return;
    }

    try {
      const db = getFirestore();

      const conditionKey = condition.toLowerCase();
      const cooldownMinutes = 60;
      const cutoffTime = Timestamp.fromMillis(
        Date.now() - cooldownMinutes * 60 * 1000
      );

      const recentAlertSnapshot = await db
        .collection("notificationLogs")
        .where("type", "==", "medical_history_alert")
        .where("userId", "==", userId)
        .where("conditionKey", "==", conditionKey)
        .where("sentAt", ">=", cutoffTime)
        .limit(1)
        .get();

      if (!recentAlertSnapshot.empty) {
        logger.info("Skipping duplicate medical history alert", {
          fn: "checkMedicalHistoryBenchmarks",
          userId,
          conditionKey,
          cooldownMinutes,
        });
        return;
      }

      // Get user info for family + display name
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      if (!userData?.familyId) {
        return;
      }

      const userName =
        userData.firstName && userData.lastName
          ? `${userData.firstName} ${userData.lastName}`
          : userData.email || "User";

      const adminIds = await getFamilyAdmins(userData.familyId);
      const adminIdsToAlert = adminIds.filter((id) => id !== userId);

      const alertSeverity = mapMedicalHistorySeverity(
        historyData.severity,
        condition
      );
      const alertEmoji = alertSeverity === "high" ? "⚠️" : "📋";

      const alertRef = await db.collection("alerts").add({
        userId,
        type: "medical_history",
        severity: alertSeverity,
        message: `Medical history update: ${condition}`,
        timestamp: Timestamp.now(),
        resolved: false,
        metadata: {
          historyId: event.params.historyId,
          condition,
          severity: historyData.severity ?? null,
          source: "medical_history_trigger",
        },
      });

      let pushResult: unknown;
      if (adminIdsToAlert.length > 0) {
        const notification = {
          title: `${alertEmoji} Medical History Update`,
          body: `${userName} added: ${condition}`,
          priority:
            alertSeverity === "high" ? ("high" as const) : ("normal" as const),
          data: {
            type: "medical_history_alert",
            userId,
            userName,
            condition,
            severity: String(historyData.severity ?? ""),
            alertId: alertRef.id,
          },
          clickAction: "OPEN_ALERT_DETAILS",
          color: alertSeverity === "high" ? "#F59E0B" : "#6B7280",
        };

        type SendPushNotification = (
          data: {
            userIds: string[];
            notification: {
              title: string;
              body: string;
              priority: "high" | "normal";
              data: Record<string, string>;
              clickAction: string;
              color: string;
            };
            notificationType: string;
          },
          context: { auth: { uid: string } }
        ) => Promise<unknown>;

        const indexModule = (await import("../index.js")) as unknown as {
          sendPushNotification: SendPushNotification;
        };

        pushResult = await indexModule.sendPushNotification(
          {
            userIds: adminIdsToAlert,
            notification,
            notificationType: "medical_history",
          },
          { auth: { uid: "system" } }
        );
      }

      await db.collection("notificationLogs").add({
        type: "medical_history_alert",
        userId,
        conditionKey,
        condition,
        recipientIds: adminIdsToAlert,
        alertId: alertRef.id,
        pushSent: adminIdsToAlert.length > 0,
        sentAt: FieldValue.serverTimestamp(),
        result: pushResult ?? null,
      });
    } catch (error) {
      logger.error("Error in checkMedicalHistoryBenchmarks", error as Error, {
        fn: "checkMedicalHistoryBenchmarks",
      });
    }
  }
);
