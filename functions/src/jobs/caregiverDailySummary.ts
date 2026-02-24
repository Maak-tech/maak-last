/**
 * Caregiver Daily Summary Cloud Function
 *
 * Scheduled every day at 08:00 UTC.
 * For each caregiver/admin with a family, sends a morning summary push
 * notification about the health status of their family members.
 */

import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

const db = () => admin.firestore();

async function sendCaregiverSummary(
  caregiverId: string,
  familyId: string
): Promise<void> {
  // Get all family members
  const familySnap = await db().collection("families").doc(familyId).get();
  if (!familySnap.exists) return;

  const familyData = familySnap.data() as { members?: string[] };
  const memberIds: string[] = (familyData.members ?? []).filter(
    (id) => id !== caregiverId
  );
  if (memberIds.length === 0) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);

  const attentionReasons: string[] = [];
  let attentionCount = 0;

  for (const memberId of memberIds.slice(0, 5)) {
    const memberSnap = await db().collection("users").doc(memberId).get();
    if (!memberSnap.exists) continue;
    const member = memberSnap.data() as { firstName?: string };
    const name = member.firstName ?? "Member";

    // Check for recent anomalies
    const anomaliesSnap = await db()
      .collection("users")
      .doc(memberId)
      .collection("anomalies")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(cutoff))
      .where("acknowledged", "==", false)
      .limit(1)
      .get();

    if (!anomaliesSnap.empty) {
      const a = anomaliesSnap.docs[0].data();
      attentionReasons.push(`${name}: ${a.vitalType as string} alert`);
      attentionCount++;
    }
  }

  let title: string;
  let body: string;

  if (attentionCount > 0) {
    title = `⚠️ ${attentionCount} family member${attentionCount > 1 ? "s" : ""} need${attentionCount === 1 ? "s" : ""} attention`;
    body = attentionReasons.slice(0, 2).join(" · ");
  } else {
    title = "✅ Family Health Check";
    body = "All family members are doing well today.";
  }

  // Send push to caregiver
  const fcmSnap = await db()
    .collection("users")
    .doc(caregiverId)
    .collection("fcm_tokens")
    .limit(5)
    .get();

  const tokens: string[] = [];
  for (const tokenDoc of fcmSnap.docs) {
    const token = tokenDoc.data().token as string;
    if (token) tokens.push(token);
  }

  if (tokens.length === 0) return;

  await Promise.allSettled(
    tokens.map((token) =>
      admin.messaging().send({
        token,
        notification: { title, body },
        data: { type: "caregiver_alert", familyId },
      })
    )
  );
}

export const caregiverDailySummary = onSchedule(
  {
    schedule: "every day 08:00",
    timeZone: "UTC",
  },
  async () => {
    // Query caregivers and admins with a familyId
    const [caregiversSnap, adminsSnap] = await Promise.all([
      db()
        .collection("users")
        .where("role", "==", "caregiver")
        .where("familyId", "!=", null)
        .limit(200)
        .get(),
      db()
        .collection("users")
        .where("role", "==", "admin")
        .where("familyId", "!=", null)
        .limit(200)
        .get(),
    ]);

    const users = [...caregiversSnap.docs, ...adminsSnap.docs];
    console.log(`Sending caregiver summaries to ${users.length} users`);

    await Promise.allSettled(
      users.map((u) => {
        const data = u.data();
        const familyId = data.familyId as string;
        if (!familyId) return Promise.resolve();
        return sendCaregiverSummary(u.id, familyId);
      })
    );

    console.log("Caregiver daily summary complete");
  }
);
