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

    // Alert for severity 4 (severe) or 5 (very severe)
    if (severity < 4) {
      return; // Not severe enough
    }

    try {
      const db = getFirestore();
      const symptomType = symptomData.type || "symptom";
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

      if (adminIdsToAlert.length === 0) {
        return;
      }

      const severityText = severity === 5 ? "very severe" : "severe";
      const severityEmoji = severity === 5 ? "🚨" : "⚠️";
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
      const result = await indexModule.sendPushNotification(
        {
          userIds: adminIdsToAlert,
          notification,
          notificationType: "symptom",
        },
        { auth: { uid: "system" } }
      );

      // Log the alert
      await db.collection("notificationLogs").add({
        type: "symptom_alert",
        userId,
        symptomType,
        severity,
        recipientIds: adminIdsToAlert,
        sentAt: FieldValue.serverTimestamp(),
        result,
      });
    } catch (error) {
      logger.error("Error in checkSymptomBenchmarks", error as Error, {
        fn: "checkSymptomBenchmarks",
      });
      // Don't throw - this is a background function
    }
  }
);
