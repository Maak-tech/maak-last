import Constants from "expo-constants";

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
  private baseURL = "https://api.openai.com/v1";
  private model = "gpt-3.5-turbo"; // Default to cheaper model

  async initialize() {
    try {
      // Get API key from app config (server-side, not user-provided)
      const config = Constants.expoConfig?.extra;
      this.apiKey = config?.openaiApiKey || null;
      
      if (!this.apiKey) {
        console.warn("OpenAI API key not configured in app.json");
      }
    } catch (error) {
      // Silently handle error
    }
  }

  async getApiKey(): Promise<string | null> {
    if (!this.apiKey) {
      await this.initialize();
    }
    return this.apiKey;
  }

  async getModel(): Promise<string> {
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
      const words = response.split(" ");
      let currentText = "";

      for (let i = 0; i < words.length; i++) {
        currentText += (i > 0 ? " " : "") + words[i];
        onChunk((i > 0 ? " " : "") + words[i]);

        // Small delay to simulate streaming
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      onComplete?.();
    } catch (error) {
      onError?.(error as Error);
    }
  }

  async createChatCompletion(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) {
      await this.initialize();
    }
    
    if (!this.apiKey) {
      throw new Error("OpenAI API key not configured. Please contact support.");
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
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

        // Silently handle error

        if (response.status === 429) {
          throw new Error(
            "API quota exceeded. Please add billing to your OpenAI account or switch to GPT-3.5 Turbo (cheaper model)."
          );
        }
        if (response.status === 401) {
          throw new Error(
            "Invalid API key. Please check your OpenAI API key in settings."
          );
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
    } catch (error) {
      // Silently handle error
      throw error;
    }
  }
}

export default new OpenAIService();
