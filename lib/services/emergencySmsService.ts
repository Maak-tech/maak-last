/**
 * Emergency SMS service — replaced Firebase Cloud Function `sendEmergencySms`
 * with a direct call to the Nuralix API (`POST /api/emergency/sms`).
 *
 * The backend looks up the user's emergency contact from Neon and dispatches
 * the SMS via Twilio, so no Twilio credentials are needed client-side.
 */

import { api } from "@/lib/apiClient";
import { logger } from "@/lib/utils/logger";

type EmergencySmsPayload = {
  alertType: "fall" | "sos";
  /** Optional override message. If omitted, the backend composes a default message. */
  message?: string;
};

export const emergencySmsService = {
  async sendEmergencySms(payload: EmergencySmsPayload): Promise<void> {
    try {
      await api.post("/api/emergency/sms", payload);
    } catch (error) {
      logger.warn("Failed to send emergency SMS", error, "SMS");
    }
  },
};
