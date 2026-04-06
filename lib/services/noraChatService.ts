/**
 * Nora Chat Service — replaces openaiService for the mobile/web app.
 *
 * Routes all Nora messages through the Nuralix Elysia API
 * (`POST /api/nora/chat`) instead of Firebase Cloud Functions.
 *
 * API responsibilities:
 *  - Injects the user's full VHI context block into the system prompt
 *  - Calls OpenAI GPT-4o with OPENAI_API_KEY from the server environment
 *  - Persists conversation history to Postgres (noraConversations table)
 *
 * Client responsibilities:
 *  - Word-by-word fake-streaming for a natural typing feel
 *  - Conversation ID tracking for session continuity
 */

import { api, ApiError } from "@/lib/apiClient";

// Base URL for direct fetch calls (SSE streaming bypasses the api wrapper,
// which imposes a 30-second timeout incompatible with streaming responses)
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Full chat message type — used by the UI component for local state.
 *
 * `"system"` role is UI-only: it holds the local system prompt string and is
 * never sent to the API. Only `"user"` / `"assistant"` messages reach the server.
 *
 * `label` is an optional display badge shown above assistant bubbles (e.g. "Insight").
 */
export type NoraChatMessage = {
  /** Local-only message ID for React key and streaming identification */
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** Optional badge text shown above the assistant message bubble */
  label?: string;
  /** Local-only creation timestamp */
  timestamp?: Date;
  /** When true, feedback thumbs-up/down buttons are not shown for this message */
  noFeedback?: boolean;
};

type ChatResponse = {
  reply: string;
  conversationId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

/** Delay between each word during fake-streaming (ms). Matches old Firebase UX. */
const WORD_DELAY_MS = 20;

// ── Service ───────────────────────────────────────────────────────────────────

class NoraChatService {
  /**
   * Send a message to Nora and receive the full reply.
   * Conversation history is passed so Nora maintains context.
   *
   * @param message       The user's new message.
   * @param history       Prior messages in this conversation (alternating user/assistant).
   * @param conversationId  Optional — pass the ID from a previous response to continue the session.
   */
  async sendMessage(
    message: string,
    history: NoraChatMessage[] = [],
    conversationId?: string
  ): Promise<ChatResponse> {
    // Strip UI-only fields (id, timestamp, label) and exclude "system" role messages
    // — the API only accepts "user" and "assistant" in history.
    const apiHistory = history
      .filter((m): m is NoraChatMessage & { role: "user" | "assistant" } =>
        m.role === "user" || m.role === "assistant"
      )
      .map(({ role, content }) => ({ role, content }));

    return api.post<ChatResponse>("/api/nora/chat", {
      message,
      history: apiHistory,
      ...(conversationId ? { conversationId } : {}),
    });
  }

  /**
   * Send a message and stream the reply in real-time using the `/chat/stream`
   * SSE endpoint. Each token from OpenAI is forwarded to `onChunk` as it
   * arrives, giving users immediate feedback instead of a 30-second blank screen.
   *
   * Falls back to fake word-by-word streaming via `sendMessage` if the browser /
   * React Native runtime does not expose `response.body` (ReadableStream).
   *
   * @param message         The user's new message.
   * @param history         Prior messages in this conversation.
   * @param onChunk         Called with the accumulated text so far after each token.
   * @param onComplete      Called once the stream ends. Receives `conversationId`.
   * @param onError         Called if the request or stream fails.
   * @param conversationId  Optional — pass to continue an existing session.
   */
  async streamMessage(
    message: string,
    history: NoraChatMessage[],
    onChunk: (accumulatedText: string) => void,
    onComplete?: (conversationId: string) => void,
    onError?: (error: Error) => void,
    conversationId?: string
  ): Promise<void> {
    // Strip UI-only fields and exclude system-role messages — identical to sendMessage
    const apiHistory = history
      .filter((m): m is NoraChatMessage & { role: "user" | "assistant" } =>
        m.role === "user" || m.role === "assistant"
      )
      .map(({ role, content }) => ({ role, content }));

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api/nora/chat/stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message,
          history: apiHistory,
          ...(conversationId ? { conversationId } : {}),
        }),
        // No AbortSignal timeout — the stream can take up to 60 s
      });
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    if (!response.ok) {
      // Surface auth failures so the UI can show an appropriate message
      const errMsg = response.status === 401
        ? "Your session has expired. Please sign in again."
        : `Request failed (${response.status})`;
      onError?.(new ApiError(errMsg, response.status));
      return;
    }

    // Fallback: ReadableStream not available in this runtime (some React Native
    // environments). Degrade gracefully to the fake word-by-word approach.
    if (!response.body) {
      let chatResponse: ChatResponse;
      try {
        chatResponse = await this.sendMessage(message, history, conversationId);
      } catch (err: unknown) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      const words = chatResponse.reply.split(" ");
      let accumulated = "";
      for (let i = 0; i < words.length; i++) {
        accumulated += (i === 0 ? "" : " ") + words[i];
        onChunk(accumulated);
        await new Promise<void>((resolve) => setTimeout(resolve, WORD_DELAY_MS));
      }
      onComplete?.(chatResponse.conversationId);
      return;
    }

    // Consume the real SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder({ fatal: false });
    let lineBuffer = "";
    let accumulated = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });

        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice("data: ".length);

          let parsed: { type?: string; token?: string; content?: string; conversationId?: string; message?: string };
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue; // Skip malformed lines
          }

          switch (parsed.type) {
            case "chunk":
              if (parsed.token) {
                accumulated += parsed.token;
                onChunk(accumulated);
              }
              break;
            case "replace":
              // Guardrail replacement — swap accumulated text with server-approved content
              if (parsed.content !== undefined) {
                accumulated = parsed.content;
                onChunk(accumulated);
              }
              break;
            case "done":
              onComplete?.(parsed.conversationId ?? "");
              return;
            case "error":
              onError?.(new Error(parsed.message ?? "Unknown streaming error"));
              return;
          }
        }
      }
    } catch (readErr: unknown) {
      onError?.(readErr instanceof Error ? readErr : new Error("Stream read failed"));
    }
  }

  /**
   * Lightweight health / access check.
   * Returns true if the server's OPENAI_API_KEY is configured.
   * Falls back to `true` if the check endpoint is unreachable (avoids blocking the UI).
   */
  async isConfigured(): Promise<boolean> {
    try {
      const result = await api.get<{ configured: boolean }>("/api/nora/health");
      return result.configured;
    } catch (err: unknown) {
      // If the health endpoint doesn't exist yet, assume configured (avoids blocking UI)
      console.warn('[noraChat] isConfigured health check failed — assuming configured:', err instanceof Error ? err.message : String(err));
      return true;
    }
  }

  /**
   * Submit a thumbs-up / thumbs-down rating for an assistant message.
   * Errors are swallowed — feedback is best-effort and must never break the chat UI.
   */
  async submitFeedback(
    rating: 1 | 5,
    conversationId?: string,
    messageId?: string,
    flag?: 'wrong' | 'harmful' | 'unhelpful' | 'helpful'
  ): Promise<void> {
    try {
      await api.post('/api/nora/feedback', {
        rating,
        conversationId,
        messageId,
        flag,
      });
    } catch (err: unknown) {
      console.warn('[noraChat] submitFeedback failed (non-blocking):', err instanceof Error ? err.message : String(err));
    }
  }
}

export const noraChatService = new NoraChatService();
export default noraChatService;
