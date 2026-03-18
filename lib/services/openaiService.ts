<<<<<<< Updated upstream
import AsyncStorage from '@react-native-async-storage/async-storage';
=======
/**
 * OpenAI service — Firebase-free replacement.
 *
 * Replaced:
 *   - httpsCallable(firebaseFunctions, "openaiChatCompletion") → api.post("/api/ai/complete", {...})
 *   - httpsCallable(firebaseFunctions, "openaiHealthCheck")    → api.get("/api/nora/health")
 *
 * All other behaviour (consent check, PII redaction, streaming shim, generateHealthInsights,
 * model selection, error classification) is preserved exactly.
 */

import { api } from "@/lib/apiClient";
import { aiInstrumenter } from "@/lib/observability";
import aiConsentService from "@/lib/services/aiConsentService";
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
    index: number;
    finish_reason: string | null;
  }>;
}

class OpenAIService {
  private apiKey: string | null = null;
  private baseURL = 'https://api.openai.com/v1';
  private model: string = 'gpt-3.5-turbo'; // Default to cheaper model

  async initialize() {
    try {
      this.apiKey = await AsyncStorage.getItem('openai_api_key');
      const savedModel = await AsyncStorage.getItem('openai_model');
      if (savedModel) {
        this.model = savedModel;
      }
    } catch (error) {
      console.error('Error loading OpenAI settings:', error);
=======
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

class OpenAIService {
  private model = "gpt-3.5-turbo";
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
    } catch {
      this.cachedHealth = { configured: false, hasAccess: false, checkedAtMs: now };
      return { configured: false, hasAccess: false };
>>>>>>> Stashed changes
    }
  }

  async setApiKey(key: string) {
    this.apiKey = key;
    await AsyncStorage.setItem('openai_api_key', key);
  }

  async getApiKey(): Promise<string | null> {
    if (!this.apiKey) {
      this.apiKey = await AsyncStorage.getItem('openai_api_key');
    }
    return this.apiKey;
  }

  async setModel(model: string) {
    this.model = model;
    await AsyncStorage.setItem('openai_model', model);
  }

  async getModel(): Promise<string> {
    if (!this.model) {
      const savedModel = await AsyncStorage.getItem('openai_model');
      this.model = savedModel || 'gpt-3.5-turbo';
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
    } catch (error) {
      onError?.(error as Error);
    }
  }

  async createChatCompletion(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }
<<<<<<< Updated upstream

    try {
      console.log(`Making OpenAI API call with model: ${this.model}`);
      
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: 0.7,
          max_tokens: 1000,
          stream: false,
        }),
      });

      console.log(`OpenAI API response status: ${response.status}`);

      if (!response.ok) {
        let errorMessage = '';
        try {
          const errorData = await response.text();
          const errorJson = JSON.parse(errorData);
          errorMessage = errorJson.error?.message || errorData;
        } catch {
          errorMessage = `HTTP ${response.status}`;
        }
        
        console.error('OpenAI API Error:', errorMessage);
        
        if (response.status === 429) {
          throw new Error('API quota exceeded. Please add billing to your OpenAI account or switch to GPT-3.5 Turbo (cheaper model).');
        } else if (response.status === 401) {
          throw new Error('Invalid API key. Please check your OpenAI API key in settings.');
        } else if (response.status === 404) {
          throw new Error(`Model ${this.model} not found. Please select a different model in settings.`);
        } else if (response.status === 400) {
          throw new Error(`Bad request: ${errorMessage}. Please check your API key and selected model.`);
        }
        
        throw new Error(`OpenAI API error: ${errorMessage}`);
=======
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
      const result = await api.post<{ content?: string; error?: string }>(
        "/api/ai/complete",
        {
          messages: sanitizedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: this.model,
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
>>>>>>> Stashed changes
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from OpenAI API');
      }
      
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error in createChatCompletion:', error);
      throw error;
    }
  }
}

export default new OpenAIService();