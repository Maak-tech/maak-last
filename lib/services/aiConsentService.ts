import AsyncStorage from "@react-native-async-storage/async-storage";

const AI_DATA_SHARING_CONSENT_KEY = "ai_data_sharing_consent_v1";

type StoredConsent = {
  consented: boolean;
  consentedAtIso?: string;
};

class AIConsentService {
  async getConsent(): Promise<StoredConsent> {
    try {
      const raw = await AsyncStorage.getItem(AI_DATA_SHARING_CONSENT_KEY);
      if (!raw) {
        return { consented: false };
      }
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "consented" in parsed
      ) {
        const consented = Boolean((parsed as StoredConsent).consented);
        const consentedAtIso =
          typeof (parsed as StoredConsent).consentedAtIso === "string"
            ? (parsed as StoredConsent).consentedAtIso
            : undefined;
        return { consented, consentedAtIso };
      }
      return { consented: false };
    } catch {
      return { consented: false };
    }
  }

  async setConsented(consented: boolean): Promise<void> {
    const payload: StoredConsent = consented
      ? { consented: true, consentedAtIso: new Date().toISOString() }
      : { consented: false };
    try {
      await AsyncStorage.setItem(
        AI_DATA_SHARING_CONSENT_KEY,
        JSON.stringify(payload)
      );
    } catch {
      // Non-blocking: app should still function without persisted consent.
    }
  }
}

export const aiConsentService = new AIConsentService();
export default aiConsentService;
