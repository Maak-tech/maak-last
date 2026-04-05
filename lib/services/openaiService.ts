/**
 * OpenAI service — Firebase-free replacement.
 *
 * Replaced:
 *   - httpsCallable(firebaseFunctions, "openaiChatCompletion") → api.post("/api/nora/complete", {...})
 *   - httpsCallable(firebaseFunctions, "openaiHealthCheck")    → api.get("/api/nora/health")
 *
 * All other behaviour (consent check, PII redaction, streaming shim, generateHealthInsights,
 * model selection, error classification) is preserved exactly.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/apiClient";
import { aiInstrumenter } from "@/lib/observability";
import aiConsentService from "@/lib/services/aiConsentService";

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export const AI_MODELS = {
  'gpt-4o-mini': 'GPT-4o Mini (Cheapest)',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo (Fast & Cheap)',
  'gpt-4': 'GPT-4 (Most Capable)',
  'gpt-4o': 'GPT-4o (Latest)',
};

type ExpectedApiError = Error & {
  isExpectedError?: boolean;
  isApiKeyError?: boolean;
};

const markExpectedApiError = (message: string): ExpectedApiError => {
  const error = new Error(message) as ExpectedApiError;
  error.isExpectedError = true;
  error.isApiKeyError = true;
  return error;
};

const markExpectedUserActionError = (message: string): ExpectedApiError => {
  const error = new Error(message) as ExpectedApiError;
  error.isExpectedError = true;
  error.isApiKeyError = false;
  return error;
};

const MARKDOWN_JSON_BLOCK_REGEX = /```(?:json)?\s*(\{[\s\S]*\})\s*```/;

const redactOutboundText = (value: string): string => {
  const emailRedacted = value.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[REDACTED]"
  );
  const phoneRedacted = emailRedacted.replace(
    /(\+?\d[\d\s().-]{7,}\d)/g,
    "[REDACTED]"
  );
  return phoneRedacted;
};

const DEFAULT_MODEL = "gpt-3.5-turbo";

class OpenAIService {
  // Empty string so getModel() reads the persisted value from AsyncStorage on first call
  private model = "";
  private apiKey: string | null = null;
  private cachedHealth: {
    configured: boolean;
    hasAccess: boolean;
    checkedAtMs: number;
  } | null = null;

  async initialize(): Promise<void> {
    // No-op: OpenAI secrets live only in the Nuralix API server.
  }

  async getAccessStatus(): Promise<{
    configured: boolean;
    hasAccess: boolean;
  }> {
    const now = Date.now();
    if (this.cachedHealth && now - this.cachedHealth.checkedAtMs < 60_000) {
      return {
        configured: this.cachedHealth.configured,
        hasAccess: this.cachedHealth.hasAccess,
      };
    }

    try {
      const result = await api.get<{ configured: boolean }>("/api/nora/health");
      const configured = Boolean(result?.configured);
      // hasAccess is true whenever configured — subscription gating is done at the route level
      this.cachedHealth = { configured, hasAccess: configured, checkedAtMs: now };
      return { configured, hasAccess: configured };
    } catch (err: unknown) {
      console.warn('[openai] Health check failed:', err);
      this.cachedHealth = { configured: false, hasAccess: false, checkedAtMs: now };
      return { configured: false, hasAccess: false };
    }
  }

  async setApiKey(key: string) {
    this.apiKey = key;
    try {
      await AsyncStorage.setItem('openai_api_key', key);
    } catch (err: unknown) {
      console.warn('[openai] Failed to persist API key:', err);
    }
  }

  async getApiKey(): Promise<string | null> {
    if (!this.apiKey) {
      try {
        this.apiKey = await AsyncStorage.getItem('openai_api_key');
      } catch (err: unknown) {
        console.warn('[openai] Failed to read API key from storage:', err);
      }
    }
    return this.apiKey;
  }

  async setModel(model: string) {
    this.model = model;
    try {
      await AsyncStorage.setItem('openai_model', model);
    } catch (err: unknown) {
      console.warn('[openai] Failed to persist model preference:', err);
    }
  }

  async getModel(): Promise<string> {
    if (!this.model) {
      try {
        const savedModel = await AsyncStorage.getItem('openai_model');
        this.model = savedModel || DEFAULT_MODEL;
      } catch (err: unknown) {
        console.warn('[openai] Failed to read saved model — using default:', err);
        this.model = DEFAULT_MODEL;
      }
    }
    return this.model;
  }

  async createChatCompletionStream(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ) {
    // React Native doesn't support streaming properly, so we'll use the regular API
    // and simulate streaming for better UX
    try {
      const response = await this.createChatCompletion(messages);
      
      // Simulate streaming by gradually revealing the response
      const words = response.split(' ');
      let currentText = '';
      
      for (let i = 0; i < words.length; i++) {
        currentText += (i > 0 ? ' ' : '') + words[i];
        onChunk((i > 0 ? ' ' : '') + words[i]);
        
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      
      onComplete?.();
    } catch (error: unknown) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async createChatCompletion(messages: ChatMessage[]): Promise<string> {
    return this.requestChatCompletion(messages, false);
  }

  /**
   * Generate health insights from a plain text prompt.
   * Wraps the prompt in a minimal ChatMessage array and returns the response text.
   */
  async generateHealthInsights(prompt: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        id: Date.now().toString(),
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      },
    ];
    return this.requestChatCompletion(messages, false);
  }

  /**
   * Returns true when the AI backend reports that it is configured and reachable.
   * Reads from the cached health-check result (refreshed every 60 s).
   */
  get isConfigured(): boolean {
    return this.cachedHealth?.configured ?? false;
  }

  private async requestChatCompletion(
    messages: ChatMessage[],
    usePremiumKey: boolean
  ): Promise<string> {
    const consent = await aiConsentService.getConsent();
    if (!consent.consented) {
      throw markExpectedUserActionError(
        "AI Data Sharing is disabled. Enable it in Profile > AI Data Sharing to use Nora and AI insights."
      );
    }

    const sanitizedMessages = messages.map((m) => ({
      ...m,
      content: redactOutboundText(m.content),
    }));

    try {
      const model = await this.getModel();
      const result = await api.post<{ content?: string; error?: string }>(
        "/api/nora/complete",
        {
          messages: sanitizedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model,
          temperature: 0.7,
          maxTokens: 1000,
          usePremiumKey,
        }
      );

      const content = result?.content;
      if (typeof content !== "string") {
        throw new Error("Invalid response format from AI service");
      }
      return content;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown AI service error";

      // Map HTTP-style errors from our API to the same user-facing messages
      if (message.includes("not configured") || message.includes("503")) {
        throw markExpectedApiError(
          "AI service is not configured. Set OPENAI_API_KEY and redeploy."
        );
      }
      if (message.includes("quota") || message.includes("429")) {
        throw new Error("AI quota exceeded. Please try again later.");
      }
      if (message.includes("signed in") || message.includes("401")) {
        throw markExpectedApiError(
          "You must be signed in to use the AI assistant."
        );
      }
      if (message.includes("subscription") || message.includes("403")) {
        throw markExpectedApiError(
          "This feature requires an active subscription."
        );
      }

      throw error;
    }
  }
}

export default new OpenAIService();