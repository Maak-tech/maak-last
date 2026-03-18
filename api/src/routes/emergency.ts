/**
 * Emergency routes — send emergency SMS alerts via Twilio.
 *
 * Replaces the Firebase Cloud Function `sendEmergencySms`.
 * The endpoint looks up the user's emergency contacts from Neon and fires
 * Twilio Messages API for each one.
 */

import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { users, alerts } from "../db/schema";
import crypto from "node:crypto";
import { emergencySmsRateLimiter } from "../lib/rateLimiter";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER ?? "";

async function sendTwilioSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn("[emergency] Twilio not configured — skipping SMS");
    return false;
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body }).toString(),
        // Hard timeout — prevents hanging connections from blocking the event loop
        signal: AbortSignal.timeout(10_000),
      }
    );
    return res.ok;
  } catch (err) {
    console.error("[emergency] Twilio send failed:", err);
    return false;
  }
}

export const emergencyRoutes = new Elysia({ prefix: "/api/emergency" })
  .use(requireAuth)

  /**
   * POST /api/emergency/sms
   * Send an emergency SMS to the user's registered emergency contact.
   * Also creates an alert record in Neon for audit and dashboard visibility.
   *
   * Rate-limited to 3 requests per user per 10 minutes to prevent Twilio
   * cost abuse and accidental flood of SMS messages.
   */
  .post(
    "/sms",
    async ({ db, userId, body, set }) => {
      // ── Rate limit ────────────────────────────────────────────────────────────
      const rl = emergencySmsRateLimiter.check(userId);
      if (!rl.allowed) {
        const retryAfterSecs = Math.ceil((rl.resetAt - Date.now()) / 1000);
        set.status = 429;
        set.headers = {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": "3",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rl.resetAt),
        };
        return {
          ok: false,
          error: "Too many emergency requests. Please wait before sending another alert.",
          retryAfter: retryAfterSecs,
        };
      }

      // Look up the user's emergency contact
      const [user] = await db
        .select({
          name: users.name,
          emergencyContactName: users.emergencyContactName,
          emergencyContactPhone: users.emergencyContactPhone,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        set.status = 404;
        return { ok: false, error: "User not found" };
      }

      const contactPhone = user.emergencyContactPhone;
      if (!contactPhone) {
        set.status = 422;
        return { ok: false, error: "No emergency contact phone configured" };
      }

      // Compose the SMS message
      const userName = user.name ?? "Your family member";
      const alertLabel = body.alertType === "fall" ? "fall alert" : "SOS alert";
      const smsBody =
        body.message ??
        `🚨 Nuralix ${alertLabel}: ${userName} may need help. Please check on them immediately or call emergency services.`;

      const sent = await sendTwilioSms(contactPhone, smsBody);

      // Create an alert record regardless of SMS outcome (for audit trail)
      const alertId = crypto.randomUUID();
      await db.insert(alerts).values({
        id: alertId,
        userId,
        type: body.alertType === "fall" ? "fall" : "emergency",
        severity: "critical",
        title: `Emergency ${alertLabel}`,
        body: smsBody,
        metadata: {
          sentToPhone: contactPhone.slice(-4).padStart(contactPhone.length, "*"),
          smsSent: sent,
          alertType: body.alertType,
        },
      });

      if (!sent) {
        // SMS failed but alert was logged — return partial success
        return {
          ok: true,
          smsSent: false,
          alertId,
          warning: "Alert logged but SMS delivery failed — check Twilio configuration",
        };
      }

      return { ok: true, smsSent: true, alertId };
    },
    {
      body: t.Object({
        alertType: t.Union([t.Literal("fall"), t.Literal("sos")]),
        message: t.Optional(t.String({ maxLength: 300 })),
      }),
      detail: {
        tags: ["emergency"],
        summary: "Send emergency SMS to registered contact (rate-limited: 3/10 min)",
      },
    }
  );
