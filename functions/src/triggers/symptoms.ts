/**
 * Symptoms Firestore Trigger
 * Checks symptoms against severity thresholds and alerts admins
 */

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFamilyAdmins } from "../modules/family/admins";
import { logger } from "../observability/logger";

/**
 * Firestore trigger: Check symptoms against benchmarks when new symptom is created
 */
export const checkSymptomBenchmarks = onDocumentCreated(
  "symptoms/{symptomId}",
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Trigger flow combines guard checks, dedupe, and notify steps.
  async (event) => {
    const symptomData = event.data?.data();
    if (!symptomData) {
      return;
    }

    const { userId, severity } = symptomData;

    if (!userId || typeof severity !== "number") {
      return;
    }

    const symptomType = symptomData.type || "symptom";

    // Escalate for severity 4 (severe) or 5 (very severe), plus a small set of
    // high-signal symptoms that should always be triaged even if the user didn't
    // explicitly rate severity.
    const highRiskSymptoms = new Set(["chestPain", "shortnessOfBreath"]);
    if (severity < 4 && !highRiskSymptoms.has(symptomType)) {
      return; // Not severe enough and not high-risk
    }

    try {
      const db = getFirestore();
      const cooldownMinutes = 5;
      const cutoffTime = Timestamp.fromMillis(
        Date.now() - cooldownMinutes * 60 * 1000
      );
      const recentAlertSnapshot = await db
        .collection("notificationLogs")
        .where("type", "==", "symptom_alert")
        .where("userId", "==", userId)
        .where("symptomType", "==", symptomType)
        .where("sentAt", ">=", cutoffTime)
        .limit(1)
        .get();

      if (!recentAlertSnapshot.empty) {
        logger.info("Skipping duplicate symptom alert", {
          fn: "checkSymptomBenchmarks",
          userId,
          symptomType,
          cooldownMinutes,
        });
        return;
      }

      // Get user info
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      if (!userData?.familyId) {
        return; // No family, no admins to alert
      }

      const userName =
        userData.firstName && userData.lastName
          ? `${userData.firstName} ${userData.lastName}`
          : userData.email || "User";

      const adminIds = await getFamilyAdmins(userData.familyId);
      const adminIdsToAlert = adminIds.filter((id) => id !== userId);

      const severityText =
        severity >= 5 ? "very severe" : severity >= 4 ? "severe" : "concerning";
      const severityEmoji = severity === 5 ? "🚨" : "⚠️";
      const alertSeverity =
        severity === 5 ? ("critical" as const) : ("high" as const);

      // Create an in-app alert so caregivers/admins can triage inside the app UI
      // (not only via push notifications).
      // Use an existing, high-visibility alert type that the app UI already renders prominently.
      // (The message/metadata still indicate it's a symptom-driven triage alert.)
      const alertRef = await db.collection("alerts").add({
        userId,
        type: "emergency",
        severity: alertSeverity,
        message: `${severityText} ${symptomType} reported`,
        timestamp: Timestamp.now(),
        resolved: false,
        metadata: {
          symptomId: event.params.symptomId,
          symptomType,
          symptomSeverity: severity,
          source: "symptom_trigger",
        },
      });

      let pushResult: unknown;
      if (adminIdsToAlert.length > 0) {
        const notification = {
          title: `${severityEmoji} Symptom Alert`,
          body: `${userName} is experiencing ${severityText} ${symptomType}`,
          priority: severity === 5 ? ("high" as const) : ("normal" as const),
          data: {
            type: "symptom_alert",
            symptomType,
            severity: severity.toString(),
            userId,
            userName,
            alertId: alertRef.id,
          },
          clickAction: "OPEN_SYMPTOMS",
          color: severity === 5 ? "#EF4444" : "#F59E0B",
        };

        // Send to admins
        // Note: This requires sendPushNotification to be exported from index.ts
        type SendPushNotification = (
          data: {
            userIds: string[];
            notification: {
              title: string;
              body: string;
              priority: "high" | "normal";
              data: {
                type: string;
                symptomType: string;
                severity: string;
                userId: string;
                userName: string;
                alertId: string;
              };
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
            notificationType: "symptom",
          },
          { auth: { uid: "system" } }
        );
      }

      // Log the alert (used for dedupe cooldown even if no push was sent).
      await db.collection("notificationLogs").add({
        type: "symptom_alert",
        userId,
        symptomType,
        severity,
        recipientIds: adminIdsToAlert,
        alertId: alertRef.id,
        pushSent: adminIdsToAlert.length > 0,
        sentAt: FieldValue.serverTimestamp(),
        result: pushResult ?? null,
      });
    } catch (error) {
      logger.error("Error in checkSymptomBenchmarks", error as Error, {
        fn: "checkSymptomBenchmarks",
      });
      // Don't throw - this is a background function
    }
  }
);
