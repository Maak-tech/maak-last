import type { FirebaseApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { logger } from "@/lib/utils/logger";

type EmergencySmsPayload = {
  userId: string;
  message: string;
  alertType: "fall" | "sos";
};

const getAuthenticatedFunctions = async () => {
  const firebaseModule = await import("@/lib/firebase");
  const auth = firebaseModule.auth;
  const app: FirebaseApp = firebaseModule.app;

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      await currentUser.getIdToken(true);
    } catch (error) {
      logger.warn("Failed to refresh auth token for SMS", error, "SMS");
    }
  }

  return getFunctions(app, "us-central1");
};

export const emergencySmsService = {
  async sendEmergencySms(payload: EmergencySmsPayload): Promise<void> {
    try {
      const functions = await getAuthenticatedFunctions();
      const sendSmsFunc = httpsCallable(functions, "sendEmergencySms");
      await sendSmsFunc(payload);
    } catch (error) {
      logger.warn("Failed to send emergency SMS", error, "SMS");
    }
  },
};
