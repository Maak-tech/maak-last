import Constants from "expo-constants";
import { aiInstrumenter } from "@/lib/observability";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export const AI_MODELS = {
  "gpt-4o-mini": "GPT-4o Mini (Cheapest)",
  "gpt-3.5-turbo": "GPT-3.5 Turbo (Fast & Cheap)",
  "gpt-4": "GPT-4 (Most Capable)",
  "gpt-4o": "GPT-4o (Latest)",
};

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
  private zeinaApiKey: string | null = null;
  private baseURL = "https://api.openai.com/v1";
  private model = "gpt-3.5-turbo"; // Default to cheaper model
  private hasLoggedKeyDebug = false;

  private maskKey(key: string | null): string {
    if (!key || key.length < 12) return "***";
    return `${key.slice(0, 7)}...${key.slice(-4)}`;
  }

  async initialize(usePremiumKey = false) {
    try {
      // Get API keys from app config (server-side, not user-provided)
      // Both regular and premium users use the same OpenAI API key
      const config = Constants.expoConfig?.extra;

      // Treat empty strings as null - normalize API keys
      const normalizeKey = (key: any): string | null => {
        if (!key || typeof key !== "string") return null;
        const trimmed = key.trim();
        return trimmed === "" ? null : trimmed;
      };

      const openaiKey = normalizeKey(config?.openaiApiKey);
      const zeinaKey = normalizeKey(config?.zeinaApiKey);

      this.apiKey = openaiKey;
      // Fallback to openaiApiKey if zeinaApiKey not set or empty
      this.zeinaApiKey = zeinaKey || openaiKey;

      if (__DEV__ && !this.hasLoggedKeyDebug) {
        this.hasLoggedKeyDebug = true;
        console.log(
          `[OpenAI] Config keys loaded. openaiApiKey=${this.maskKey(openaiKey)} zeinaApiKey=${this.maskKey(zeinaKey)}`
        );
      }

      // API key validation handled in getApiKey method
    } catch (error) {
      if (__DEV__) {
      }
    }
  }

  async getApiKey(usePremiumKey = false): Promise<string | null> {
    // Use only the provided parameter to ensure context-specific behavior
    // Do not rely on instance state from previous calls
    const shouldUseZeinaKey = usePremiumKey;

    // Initialize only once if keys are not already loaded
    if (
      !(this.apiKey || shouldUseZeinaKey) ||
      (!this.zeinaApiKey && shouldUseZeinaKey)
    ) {
      await this.initialize(shouldUseZeinaKey);
    }

    // Return the requested key type, fail explicitly if not available
    if (shouldUseZeinaKey) {
      if (
        !this.zeinaApiKey ||
        (typeof this.zeinaApiKey === "string" && this.zeinaApiKey.trim() === "")
      ) {
        throw new Error(
          "Zeina API key not configured. Provide OPENAI_API_KEY or ZEINA_API_KEY at build time and rebuild the app."
        );
      }
      return this.zeinaApiKey;
    }
    if (
      !this.apiKey ||
      (typeof this.apiKey === "string" && this.apiKey.trim() === "")
    ) {
      throw new Error(
        "OpenAI API key not configured. Provide OPENAI_API_KEY at build time and rebuild the app."
      );
    }
    return this.apiKey;
  }

  async getModel(): Promise<string> {
    return this.model;
  }

  async setModel(model: string): Promise<void> {
    this.model = model;
  }

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
      let currentText = "";

      for (let i = 0; i < words.length; i += BATCH_SIZE) {
        const batch = words.slice(i, i + BATCH_SIZE);
        const batchText = (i > 0 ? " " : "") + batch.join(" ");
        currentText += batchText;
        onChunk(batchText);

        // Reduced delay for better responsiveness while maintaining smooth UX
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      onComplete?.();
    } catch (error) {
      onError?.(error as Error);
    }
  }

  async createChatCompletion(
    messages: ChatMessage[],
    usePremiumKey = false
  ): Promise<string> {
    // Check API key before wrapping with observability to avoid logging expected errors
    let activeApiKey: string | null = null;
    try {
      activeApiKey = await this.getApiKey(usePremiumKey);
    } catch (apiKeyError: any) {
      // If API key is not configured, create a special error that won't be logged as an error
      const error = new Error(
        apiKeyError?.message ||
          "OpenAI API key not configured. Provide OPENAI_API_KEY at build time and rebuild the app."
      );
      // Mark this as an expected error so observability can handle it appropriately
      (error as any).isExpectedError = true;
      (error as any).isApiKeyError = true;
      throw error;
    }

    if (!activeApiKey || activeApiKey.trim() === "") {
      const error = new Error(
        "OpenAI API key not configured. Provide OPENAI_API_KEY at build time and rebuild the app."
      );
      (error as any).isExpectedError = true;
      (error as any).isApiKeyError = true;
      throw error;
    }

    if (__DEV__ && !this.hasLoggedKeyDebug) {
      this.hasLoggedKeyDebug = true;
      console.log(
        `[OpenAI] Using API key ${this.maskKey(activeApiKey)} with model ${this.model}`
      );
    }

    return aiInstrumenter.track(
      "chat_completion",
      async () => {
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
            const error = new Error(
              "Invalid or expired OpenAI API key. The API key must be configured at build time via OPENAI_API_KEY or ZEINA_API_KEY environment variable. Please check your .env file and rebuild the app."
            );
            // Mark as expected error for graceful handling
            (error as any).isExpectedError = true;
            (error as any).isApiKeyError = true;
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

        if (!(data.choices && data.choices[0] && data.choices[0].message)) {
          throw new Error("Invalid response format from OpenAI API");
        }

        return data.choices[0].message.content;
      },
      { trackLatency: true }
    );
  }

  async generateHealthInsights(
    prompt: string,
    usePremiumKey = false
  ): Promise<any> {
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
          const jsonMatch = response.match(
            /```(?:json)?\s*(\{[\s\S]*\})\s*```/
          );
          const jsonString = jsonMatch ? jsonMatch[1] : response.trim();
          return JSON.parse(jsonString);
        } catch (parseError) {
          // If parsing fails, return the raw response wrapped in a narrative property
          return { narrative: response };
        }
      } catch (apiError: any) {
        // Handle API key errors gracefully - these are marked as expected errors
        // and won't be logged by the observability system
        if (apiError?.isApiKeyError || apiError?.isExpectedError) {
          return null;
        }

        // For other errors, rethrow to be caught by outer catch
        throw apiError;
      }
    } catch (error: any) {
      // Keep console noise low; callers already handle fallbacks.
      // Only log unexpected errors (API key errors are already handled above)
      if (__DEV__ && !error?.isApiKeyError && !error?.isExpectedError) {
        console.warn("generateHealthInsights failed", error);
      }
      return null;
    }
  }
}

export default new OpenAIService();
