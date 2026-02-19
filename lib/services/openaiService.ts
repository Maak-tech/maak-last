import { httpsCallable } from "firebase/functions";
import { functions as firebaseFunctions } from "@/lib/firebase";
import { aiInstrumenter } from "@/lib/observability";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
};

export const AI_MODELS = {
  "gpt-4o-mini": "GPT-4o Mini (Cheapest)",
  "gpt-3.5-turbo": "GPT-3.5 Turbo (Fast & Cheap)",
  "gpt-4": "GPT-4 (Most Capable)",
  "gpt-4o": "GPT-4o (Latest)",
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

const isFirebaseFunctionsError = (
  error: unknown
): error is { code?: string; message?: string } =>
  typeof error === "object" && error !== null && "message" in error;

const MARKDOWN_JSON_BLOCK_REGEX = /```(?:json)?\s*(\{[\s\S]*\})\s*```/;

class OpenAIService {
  private model = "gpt-3.5-turbo";
  private cachedHealth: {
    configured: boolean;
    hasAccess: boolean;
    checkedAtMs: number;
  } | null = null;

  async initialize(): Promise<void> {
    // No-op: OpenAI secrets live only in Firebase Functions.
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

    const healthCheck = httpsCallable<
      Record<string, never>,
      { configured?: boolean; hasAccess?: boolean }
    >(firebaseFunctions, "openaiHealthCheck");

    try {
      const result = await healthCheck({});
      const configured = Boolean(result.data?.configured);
      const hasAccess = Boolean(result.data?.hasAccess);
      this.cachedHealth = { configured, hasAccess, checkedAtMs: now };
      return { configured, hasAccess };
    } catch {
      this.cachedHealth = {
        configured: false,
        hasAccess: false,
        checkedAtMs: now,
      };
      return { configured: false, hasAccess: false };
    }
  }

  async isConfigured(): Promise<boolean> {
    const status = await this.getAccessStatus();
    return status.configured && status.hasAccess;
  }

  getModel(): Promise<string> {
    return Promise.resolve(this.model);
  }

  setModel(model: string): Promise<void> {
    this.model = model;
    return Promise.resolve();
  }

  /* biome-ignore lint/nursery/useMaxParams: Stream callback API intentionally accepts chunk/complete/error handlers plus premium-key selector for caller ergonomics. */
  async createChatCompletionStream(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void,
    usePremiumKey = false
  ) {
    // React Native streaming is flaky; keep the existing "fake streaming" UX.
    try {
      const response = await this.createChatCompletion(messages, usePremiumKey);

      const words = response.split(" ");
      let currentText = "";
      for (let i = 0; i < words.length; i++) {
        currentText += (i === 0 ? "" : " ") + words[i];
        onChunk(currentText);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      onComplete?.();
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }

  async createChatCompletion(
    messages: ChatMessage[],
    usePremiumKey = false
  ): Promise<string> {
    return aiInstrumenter.track("chat_completion", () =>
      this.requestChatCompletion(messages, usePremiumKey)
    );
  }

  async generateHealthInsights(
    prompt: string,
    usePremiumKey = false
  ): Promise<Record<string, unknown> | null> {
    try {
      const messages: ChatMessage[] = [
        {
          id: `msg-${Date.now()}`,
          role: "system",
          content:
            "You are a helpful health AI assistant. Always respond with valid JSON format.",
          timestamp: new Date(),
        },
        {
          id: `msg-${Date.now()}-1`,
          role: "user",
          content: prompt,
          timestamp: new Date(),
        },
      ];

      const response = await this.createChatCompletion(messages, usePremiumKey);

      try {
        const jsonMatch = response.match(MARKDOWN_JSON_BLOCK_REGEX);
        const jsonString = jsonMatch ? jsonMatch[1] : response.trim();
        return JSON.parse(jsonString) as Record<string, unknown>;
      } catch {
        return { narrative: response };
      }
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        ((error as ExpectedApiError).isExpectedError ||
          (error as ExpectedApiError).isApiKeyError)
      ) {
        return null;
      }
      return null;
    }
  }

  private async requestChatCompletion(
    messages: ChatMessage[],
    usePremiumKey: boolean
  ): Promise<string> {
    const chatCompletion = httpsCallable<
      {
        messages: Array<{ role: string; content: string }>;
        model: string;
        temperature: number;
        maxTokens: number;
        usePremiumKey: boolean;
      },
      { content?: string }
    >(firebaseFunctions, "openaiChatCompletion");

    try {
      const result = await chatCompletion({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        model: this.model,
        temperature: 0.7,
        maxTokens: 1000,
        usePremiumKey,
      });

      const content = result.data?.content;
      if (typeof content !== "string") {
        throw new Error("Invalid response format from AI service");
      }
      return content;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown AI service error";

      if (isFirebaseFunctionsError(error)) {
        const code = (error as { code?: string }).code;
        if (code === "failed-precondition") {
          throw markExpectedApiError(
            "AI service is not configured. Set Firebase Functions secret OPENAI_API_KEY and redeploy."
          );
        }
        if (code === "permission-denied") {
          throw markExpectedApiError(
            "AI is available only for active Family Plan subscribers."
          );
        }
        if (code === "unauthenticated") {
          throw markExpectedApiError(
            "You must be signed in to use the AI assistant."
          );
        }
        if (code === "resource-exhausted") {
          throw new Error("AI quota exceeded. Please try again later.");
        }
      }

      throw new Error(message);
    }
  }
}

export default new OpenAIService();
