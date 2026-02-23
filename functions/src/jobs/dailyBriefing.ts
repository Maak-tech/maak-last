/**
 * Daily Briefing Cloud Function
 *
 * Scheduled every day at 07:00 UTC.
 * For each premium user, generates a personalized AI health summary,
 * stores it in users/{userId}/briefings/{YYYY-MM-DD}, and sends a push notification.
 */

import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFunctions, httpsCallable } from "firebase-admin/functions";

const db = () => admin.firestore();

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function generateBriefingForUser(
  userId: string,
  firstName: string,
  isPremium: boolean
): Promise<void> {
  if (!isPremium) return;

  const todayKey = getTodayKey();
  const briefingRef = db()
    .collection("users")
    .doc(userId)
    .collection("briefings")
    .doc(todayKey);

  // Skip if already generated today
  const existing = await briefingRef.get();
  if (existing.exists) return;

  // Fetch recent health data in parallel
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const [symptomsSnap, medsSnap, anomaliesSnap] = await Promise.all([
    db()
      .collection("users")
      .doc(userId)
      .collection("symptoms")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(cutoff))
      .orderBy("timestamp", "desc")
      .limit(10)
      .get(),
    db()
      .collection("users")
      .doc(userId)
      .collection("medications")
      .where("isActive", "==", true)
      .limit(10)
      .get(),
    db()
      .collection("users")
      .doc(userId)
      .collection("anomalies")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(cutoff))
      .orderBy("timestamp", "desc")
      .limit(3)
      .get(),
  ]);

  const symptoms = symptomsSnap.docs.map((d) => ({
    type: d.data().type,
    severity: d.data().severity,
  }));
  const medications = medsSnap.docs.map((d) => d.data().name);
  const anomalies = anomaliesSnap.docs.map((d) => ({
    type: d.data().vitalType,
    severity: d.data().severity,
  }));

  // Build a concise prompt
  const symptomSummary =
    symptoms.length > 0
      ? `Recent symptoms: ${symptoms.map((s) => `${s.type} (severity ${s.severity})`).join(", ")}.`
      : "No symptoms logged this week.";
  const medSummary =
    medications.length > 0
      ? `Active medications: ${medications.join(", ")}.`
      : "No active medications.";
  const anomalySummary =
    anomalies.length > 0
      ? `Vital alerts: ${anomalies.map((a) => `${a.type} (${a.severity})`).join(", ")}.`
      : "No vital alerts.";

  const prompt = `You are a friendly health AI assistant. Generate a personalized morning health briefing for ${firstName}.

Health data:
- ${symptomSummary}
- ${medSummary}  
- ${anomalySummary}

Write a warm, encouraging 2-3 sentence summary in plain language. Then provide 2-3 short bullet-point highlights.
Respond with valid JSON: {"summary": "...", "highlights": ["...", "..."], "highlightsAr": ["...", "..."], "summaryAr": "..."}
Keep each highlight under 8 words. The Arabic fields should be accurate Arabic translations.`;

  try {
    // Call the existing openaiChatCompletion Cloud Function
    const openaiFn = admin
      .app()
      .functions("us-central1");

    // Use Firestore to queue the OpenAI call via a helper pattern
    // (direct fetch to avoid circular Cloud Function calling — use OpenAI REST API)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.warn("OPENAI_API_KEY not set — skipping briefing for", userId);
      return;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error for user", userId, response.status);
      return;
    }

    const result = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const raw = result.choices?.[0]?.message?.content ?? "";

    let summary = `Good morning, ${firstName}! Here's your health summary for today.`;
    let summaryAr = `صباح الخير ${firstName}! إليك ملخصك الصحي لليوم.`;
    let highlights: string[] = [];
    let highlightsAr: string[] = [];

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          summary?: string;
          summaryAr?: string;
          highlights?: string[];
          highlightsAr?: string[];
        };
        if (parsed.summary) summary = parsed.summary;
        if (parsed.summaryAr) summaryAr = parsed.summaryAr;
        if (Array.isArray(parsed.highlights)) highlights = parsed.highlights;
        if (Array.isArray(parsed.highlightsAr)) highlightsAr = parsed.highlightsAr;
      }
    } catch {
      // Use defaults
    }

    // Store briefing
    await briefingRef.set({
      summary,
      summaryAr,
      highlights,
      highlightsAr,
      generatedAt: admin.firestore.Timestamp.now(),
    });

    // Send push notification (first sentence only)
    const notifBody = summary.split(".")[0] + ".";
    const fcmSnap = await db()
      .collection("users")
      .doc(userId)
      .collection("fcm_tokens")
      .limit(5)
      .get();

    const tokens: string[] = [];
    for (const tokenDoc of fcmSnap.docs) {
      const token = tokenDoc.data().token as string;
      if (token) tokens.push(token);
    }

    if (tokens.length > 0) {
      const messages = tokens.map((token) => ({
        token,
        notification: {
          title: "🌅 Daily Health Briefing",
          body: notifBody,
        },
        data: { type: "daily_briefing", date: todayKey },
      }));

      await Promise.allSettled(
        messages.map((m) => admin.messaging().send(m))
      );
    }
  } catch (err) {
    console.error("Error generating briefing for user", userId, err);
  }
}

export const dailyBriefing = onSchedule(
  {
    schedule: "every day 07:00",
    timeZone: "UTC",
    secrets: ["OPENAI_API_KEY"],
  },
  async () => {
    // Query all premium users
    const usersSnap = await db()
      .collection("users")
      .where("isPremium", "==", true)
      .limit(500)
      .get();

    console.log(`Generating briefings for ${usersSnap.size} premium users`);

    // Process in batches of 10
    const users = usersSnap.docs;
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map((u) => {
          const data = u.data();
          return generateBriefingForUser(
            u.id,
            (data.firstName as string) ?? "there",
            Boolean(data.isPremium)
          );
        })
      );
    }

    console.log("Daily briefing generation complete");
  }
);
