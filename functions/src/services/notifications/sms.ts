/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: emergency-contact normalization and SMS dispatch handle multiple legacy payload shapes. */
import { getFirestore } from "firebase-admin/firestore";
import twilio from "twilio";
import { logger } from "../../observability/logger";

type EmergencyContact = {
  id?: string;
  name: string;
  phone: string;
};

const normalizeEmergencyContacts = (
  rawContacts: unknown
): EmergencyContact[] => {
  if (!Array.isArray(rawContacts)) {
    return [];
  }

  const contacts: EmergencyContact[] = [];

  for (const [index, contact] of rawContacts.entries()) {
    if (typeof contact === "string" && contact.trim()) {
      contacts.push({
        id: `legacy-${index}`,
        name: "Emergency Contact",
        phone: contact.trim(),
      });
      continue;
    }

    if (contact && typeof contact === "object") {
      const name =
        typeof (contact as { name?: string }).name === "string"
          ? (contact as { name?: string }).name?.trim() || ""
          : "";
      const phone =
        typeof (contact as { phone?: string }).phone === "string"
          ? (contact as { phone?: string }).phone?.trim() || ""
          : "";
      const id =
        typeof (contact as { id?: string }).id === "string"
          ? (contact as { id?: string }).id?.trim() || ""
          : "";

      if (name && phone) {
        contacts.push({
          id,
          name,
          phone,
        });
      }
    }
  }

  return contacts;
};

const getTwilioClient = (accountSid?: string, authToken?: string) => {
  const sid = accountSid || process.env.TWILIO_ACCOUNT_SID;
  const token = authToken || process.env.TWILIO_AUTH_TOKEN;

  if (!(sid && token)) {
    return null;
  }

  try {
    return twilio(sid, token);
  } catch (error) {
    logger.error("Failed to initialize Twilio client", error as Error, {
      fn: "getTwilioClient",
    });
    return null;
  }
};

export const sendEmergencySmsToContacts = async ({
  userId,
  message,
  twilioAccountSid,
  twilioAuthToken,
  twilioFromNumber,
}: {
  userId: string;
  message: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
}): Promise<{ success: boolean; sent: number; failed: number }> => {
  const fromNumber = twilioFromNumber || process.env.TWILIO_FROM_NUMBER;
  const twilioClient = getTwilioClient(twilioAccountSid, twilioAuthToken);

  if (!(twilioClient && fromNumber)) {
    logger.warn("Twilio is not configured; skipping SMS send", {
      fn: "sendEmergencySmsToContacts",
      uid: userId,
    });
    return { success: false, sent: 0, failed: 0 };
  }

  const userDoc = await getFirestore().collection("users").doc(userId).get();
  if (!userDoc.exists) {
    logger.warn("User not found for SMS send", {
      fn: "sendEmergencySmsToContacts",
      uid: userId,
    });
    return { success: false, sent: 0, failed: 0 };
  }

  const userData = userDoc.data() || {};
  const contacts = normalizeEmergencyContacts(
    userData.preferences?.emergencyContacts
  );

  if (contacts.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    contacts.map((contact) =>
      twilioClient.messages.create({
        from: fromNumber,
        to: contact.phone,
        body: message,
      })
    )
  );

  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;

  if (failed > 0) {
    logger.warn("Some emergency SMS messages failed", {
      fn: "sendEmergencySmsToContacts",
      uid: userId,
      sent,
      failed,
    });
  }

  return { success: failed === 0, sent, failed };
};
