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
   * Send a message and stream the reply word-by-word (same UX as the old
   * Firebase implementation: full response is received, then emitted
   * incrementally to match the typewriter feel).
   *
   * @param message       The user's new message.
   * @param history       Prior messages in this conversation.
   * @param onChunk       Called with the accumulated text so far after each word.
   * @param onComplete    Called once all words have been emitted. Receives `conversationId`.
   * @param onError       Called if the API request fails.
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
    let response: ChatResponse;
    try {
      response = await this.sendMessage(message, history, conversationId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
      return;
    }

    const { reply, conversationId: newConversationId } = response;

    // Word-by-word emission
    const words = reply.split(" ");
    let accumulated = "";
    for (let i = 0; i < words.length; i++) {
      accumulated += (i === 0 ? "" : " ") + words[i];
      onChunk(accumulated);
      // Yield to React's event loop so UI updates are visible between words
      await new Promise<void>((resolve) => setTimeout(resolve, WORD_DELAY_MS));
    }

    onComplete?.(newConversationId);
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
    } catch {
      // If the health endpoint doesn't exist yet, assume configured
      return true;
    }
  }
}

export const noraChatService = new NoraChatService();
export default noraChatService;
