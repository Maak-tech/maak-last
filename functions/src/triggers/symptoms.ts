/**
 * Symptoms Firestore Trigger
 * Checks symptoms against severity thresholds and alerts admins
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFamilyAdmins } from "../modules/family/admins";
import { logger } from "../observability/logger";

/**
 * Firestore trigger: Check symptoms against benchmarks when new symptom is created
 */
export const checkSymptomBenchmarks = onDocumentCreated(
  "symptoms/{symptomId}",
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
      // Get user info
      const db = admin.firestore();
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
      const symptomType = symptomData.type || "symptom";

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
      const indexModule = (await import("../index.js")) as any;
      const result = await indexModule.sendPushNotification(
        {
          userIds: adminIdsToAlert,
          notification,
          notificationType: "symptom",
        },
        { auth: { uid: "system" } } as any
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
