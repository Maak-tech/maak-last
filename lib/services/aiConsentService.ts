/**
 * AI Consent Service
 * Manages user consent for AI-powered features (Nora chat, health insights).
 * Consent is stored persistently so it survives app restarts.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const CONSENT_KEY = "nuralix_ai_consent_v1";

export interface AIConsent {
  consented: boolean;
  consentedAt?: string;   // ISO timestamp
  version?: number;       // consent version for future re-prompts
}

const aiConsentService = {
  async getConsent(): Promise<AIConsent> {
    try {
      const raw = await AsyncStorage.getItem(CONSENT_KEY);
      if (raw) return JSON.parse(raw) as AIConsent;
      return { consented: false };
    } catch {
      return { consented: false };
    }
  },

  async setConsent(consented: boolean): Promise<void> {
    try {
      const consent: AIConsent = {
        consented,
        consentedAt: new Date().toISOString(),
        version: 1,
      };
      await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    } catch (err) {
      console.warn('[aiConsentService] Failed to persist AI consent:', err);
    }
  },

  async hasConsented(): Promise<boolean> {
    const consent = await this.getConsent();
    return consent.consented === true;
  },

  async revokeConsent(): Promise<void> {
    await this.setConsent(false);
  },
};

export default aiConsentService;
