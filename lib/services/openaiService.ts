import Constants from "expo-constants";
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

export type ChatCompletionChunk = {
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
const MARKDOWN_JSON_BLOCK_REGEX = /```(?:json)?\s*(\{[\s\S]*\})\s*```/;

class OpenAIService {
  private apiKey: string | null = null;
  private zeinaApiKey: string | null = null;
  private readonly baseURL = "https://api.openai.com/v1";
  private model = "gpt-3.5-turbo"; // Default to cheaper model

  private normalizeKey(key: unknown): string | null {
    if (typeof key !== "string") {
      return null;
    }
    let trimmed = key.trim();
    if (!trimmed) {
      return null;
    }
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    if (trimmed.toLowerCase().startsWith("bearer ")) {
      trimmed = trimmed.slice(7).trim();
    }
    return trimmed || null;
  }

  initialize(_usePremiumKey = false): void {
    try {
      // Get API keys from app config (server-side, not user-provided)
      // Both regular and premium users use the same OpenAI API key
      const config = Constants.expoConfig?.extra;
      const configOpenAIKey = this.normalizeKey(config?.openaiApiKey);
      const configZeinaKey = this.normalizeKey(config?.zeinaApiKey);
      const envOpenAIKey = this.normalizeKey(
        process.env.EXPO_PUBLIC_OPENAI_API_KEY
      );
      const envZeinaKey = this.normalizeKey(
        process.env.EXPO_PUBLIC_ZEINA_API_KEY
      );

      const openaiKey = configOpenAIKey || envOpenAIKey;
      const zeinaKey = configZeinaKey || envZeinaKey || envOpenAIKey;

      this.apiKey = openaiKey;
      // Fallback to openaiApiKey if zeinaApiKey not set or empty
      this.zeinaApiKey = zeinaKey || openaiKey;

      // API key validation handled in getApiKey method
    } catch (_error) {
      // Ignore initialization failure; getApiKey handles validation explicitly.
    }
  }

  getApiKey(usePremiumKey = false): Promise<string | null> {
    // Use only the provided parameter to ensure context-specific behavior
    // Do not rely on instance state from previous calls
    const shouldUseZeinaKey = usePremiumKey;

    // Initialize only once if keys are not already loaded
    if (
      !(this.apiKey || shouldUseZeinaKey) ||
      (!this.zeinaApiKey && shouldUseZeinaKey)
    ) {
      this.initialize(shouldUseZeinaKey);
    }

    // Return the requested key type, fail explicitly if not available
    if (shouldUseZeinaKey) {
      if (
        !this.zeinaApiKey ||
        (typeof this.zeinaApiKey === "string" && this.zeinaApiKey.trim() === "")
      ) {
        throw new Error(
          "Zeina API key not configured. Set ZEINA_API_KEY or OPENAI_API_KEY in EAS environment (or EXPO_PUBLIC_ZEINA_API_KEY / EXPO_PUBLIC_OPENAI_API_KEY) and rebuild."
        );
      }
      return Promise.resolve(this.zeinaApiKey);
    }
    if (
      !this.apiKey ||
      (typeof this.apiKey === "string" && this.apiKey.trim() === "")
    ) {
      throw new Error(
        "OpenAI API key not configured. Set OPENAI_API_KEY in EAS environment (or EXPO_PUBLIC_OPENAI_API_KEY) and rebuild."
      );
    }
    return Promise.resolve(this.apiKey);
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
    // React Native doesn't support streaming properly, so we'll use the regular API
    // and simulate streaming for better UX
    try {
      const response = await this.createChatCompletion(messages, usePremiumKey);

      // Optimized streaming: batch words together for better performance
      const words = response.split(" ");
      const BATCH_SIZE = 3; // Process 3 words at a time

      for (let i = 0; i < words.length; i += BATCH_SIZE) {
        const batch = words.slice(i, i + BATCH_SIZE);
        const batchText = (i > 0 ? " " : "") + batch.join(" ");
        onChunk(batchText);

        // Reduced delay for better responsiveness while maintaining smooth UX
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      onComplete?.();
    } catch (error) {
      onError?.(error as Error);
    }
  }

  private async requestChatCompletion(
    messages: ChatMessage[],
    activeApiKey: string
  ): Promise<string> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeApiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
        max_tokens: 1000,
        stream: false,
      }),
    });

    if (!response.ok) {
      let errorMessage = "";
      try {
        const errorData = await response.text();
        const errorJson = JSON.parse(errorData);
        errorMessage = errorJson.error?.message || errorData;
      } catch {
        errorMessage = `HTTP ${response.status}`;
      }

      if (response.status === 429) {
        throw new Error(
          "API quota exceeded. Please add billing to your OpenAI account or switch to GPT-3.5 Turbo (cheaper model)."
        );
      }
      if (response.status === 401) {
        const error = markExpectedApiError(
          "Invalid or expired OpenAI API key. Verify OPENAI_API_KEY / ZEINA_API_KEY values in your EAS environment, then rebuild the app."
        );
        throw error;
      }
      if (response.status === 404) {
        throw new Error(
          `Model ${this.model} not found. Please select a different model in settings.`
        );
      }
      if (response.status === 400) {
        throw new Error(
          `Bad request: ${errorMessage}. Please check your API key and selected model.`
        );
      }

      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = await response.json();

    if (!data.choices?.[0]?.message) {
      throw new Error("Invalid response format from OpenAI API");
    }

    return data.choices[0].message.content;
  }

  async createChatCompletion(
    messages: ChatMessage[],
    usePremiumKey = false
  ): Promise<string> {
    // Check API key before wrapping with observability to avoid logging expected errors
    let activeApiKey: string | null = null;
    try {
      activeApiKey = await this.getApiKey(usePremiumKey);
    } catch (apiKeyError: unknown) {
      // If API key is not configured, create a special error that won't be logged as an error
      const error = markExpectedApiError(
        (apiKeyError instanceof Error ? apiKeyError.message : undefined) ||
          "OpenAI API key not configured. Set OPENAI_API_KEY in EAS environment and rebuild the app."
      );
      throw error;
    }

    if (!activeApiKey || activeApiKey.trim() === "") {
      const error = markExpectedApiError(
        "OpenAI API key not configured. Set OPENAI_API_KEY in EAS environment and rebuild the app."
      );
      throw error;
    }

    return aiInstrumenter.track("chat_completion", () =>
      this.requestChatCompletion(messages, activeApiKey)
    );
  }

  async generateHealthInsights(
    prompt: string,
    usePremiumKey = false
  ): Promise<Record<string, unknown> | null> {
    try {
      // Avoid noisy stack traces when the app hasn't been configured with an API key yet.
      // Let callers fall back gracefully.
      let apiKey: string | null = null;
      try {
        apiKey = await this.getApiKey(usePremiumKey);
      } catch {
        // API key not configured - return null silently
        return null;
      }

      // If API key is null or empty, return null without making API call
      if (!apiKey || apiKey.trim() === "") {
        return null;
      }

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

      try {
        const response = await this.createChatCompletion(
          messages,
          usePremiumKey
        );

        // Try to parse JSON from the response
        try {
          // Extract JSON from markdown code blocks if present
          const jsonMatch = response.match(MARKDOWN_JSON_BLOCK_REGEX);
          const jsonString = jsonMatch ? jsonMatch[1] : response.trim();
          return JSON.parse(jsonString) as Record<string, unknown>;
        } catch (_parseError) {
          // If parsing fails, return the raw response wrapped in a narrative property
          return { narrative: response };
        }
      } catch (apiError: unknown) {
        // Handle API key errors gracefully - these are marked as expected errors
        // and won't be logged by the observability system
        if (
          apiError instanceof Error &&
          ((apiError as ExpectedApiError).isApiKeyError ||
            (apiError as ExpectedApiError).isExpectedError)
        ) {
          return null;
        }

        // For other errors, rethrow to be caught by outer catch
        throw apiError;
      }
    } catch (_error) {
      // Keep console noise low; callers already handle fallbacks.
      return null;
    }
  }
}

export default new OpenAIService();
