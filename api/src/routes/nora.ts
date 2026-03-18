import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/requireAuth";
import { vhi, noraConversations } from "../db/schema";
import { chatRateLimiter, completionRateLimiter, realtimeSessionRateLimiter, transcribeRateLimiter } from "../lib/rateLimiter";

export const noraRoutes = new Elysia({ prefix: "/api/nora" })
  .use(requireAuth)

  // Chat with Nora — sends a message and gets a response.
  // Nora receives the full VHI context block for informed, personalised responses.
  .post(
    "/chat",
    async ({ db, userId, body, set }) => {
      // Guard: fail fast if key is missing so the client gets a meaningful error
      if (!process.env.OPENAI_API_KEY?.startsWith("sk-")) {
        set.status = 503;
        return { error: "AI service is not configured. Contact support." };
      }

      // Per-user rate limiting — 20 GPT-4o calls / user / minute
      const rl = chatRateLimiter.check(userId);
      if (!rl.allowed) {
        const retryAfterSecs = Math.ceil((rl.resetAt - Date.now()) / 1000);
        set.status = 429;
        set.headers = {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        };
        return { error: "Too many requests. Please wait before sending another message.", retryAfter: retryAfterSecs };
      }

      // Fetch current VHI context
      const [userVhi] = await db.select().from(vhi).where(eq(vhi.userId, userId)).limit(1);
      const vhiContext = userVhi?.data?.noraContextBlock ?? "";

      // Build system prompt with VHI context
      const systemPrompt = [
        "You are Nora, Nuralix's AI health assistant.",
        "You help users understand their Virtual Health Identity — what's helping their health and what's hurting it.",
        "You explain health signals in plain language, connect patterns to their personal baseline, and guide them to the right next step.",
        "You do not diagnose. You explain, support, and guide.",
        "",
        vhiContext
          ? `## Virtual Health Identity\n${vhiContext}`
          : "No VHI data available yet. Ask the user to log some health data first.",
      ].join("\n");

      // Call OpenAI
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            ...(body.history ?? []),
            { role: "user", content: body.message },
          ],
          max_tokens: 600,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(30_000), // 30-second ceiling
      });

      // Propagate OpenAI errors to the caller with the correct HTTP status
      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        if (openaiRes.status === 429) {
          set.status = 429;
          return { error: "AI quota exceeded. Please try again in a moment." };
        }
        if (openaiRes.status === 401) {
          set.status = 503;
          return { error: "AI service is not configured. Contact support." };
        }
        console.error("[nora/chat] OpenAI error:", openaiRes.status, errText);
        set.status = 502;
        return { error: "AI service temporarily unavailable. Please try again." };
      }

      const data = (await openaiRes.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const reply =
        data.choices[0]?.message?.content ??
        "I'm unable to respond right now. Please try again.";

      // Persist conversation (async, non-blocking)
      const conversationId = body.conversationId ?? crypto.randomUUID();
      const now = new Date().toISOString();

      const fullMessages = [
        ...(body.history ?? []).map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          timestamp: now,
        })),
        { role: "user" as const, content: body.message, timestamp: now },
        { role: "assistant" as const, content: reply, timestamp: now },
      ];

      db.insert(noraConversations)
        .values({
          id: conversationId,
          userId,
          messages: fullMessages,
          vhiVersionAtStart: userVhi?.version ?? null,
        })
        .onConflictDoUpdate({
          target: [noraConversations.id],
          set: { messages: fullMessages, updatedAt: new Date() },
        })
        .catch(console.error);

      return { reply, conversationId };
    },
    {
      body: t.Object({
        // Cap message length to prevent runaway token costs (≈ 500 words)
        message: t.String({ minLength: 1, maxLength: 2000 }),
        conversationId: t.Optional(t.String()),
        // Cap history depth — older turns are less useful and inflate token usage
        history: t.Optional(
          t.Array(
            t.Object({
              role: t.Union([t.Literal("user"), t.Literal("assistant")]),
              // Individual message content cap
              content: t.String({ maxLength: 4000 }),
            }),
            { maxItems: 50 }
          )
        ),
      }),
      detail: { tags: ["nora"], summary: "Chat with Nora (VHI-aware)" },
    }
  )

  // Get conversation history
  .get(
    "/conversations",
    async ({ db, userId }) => {
      return db
        .select({ id: noraConversations.id, createdAt: noraConversations.createdAt, updatedAt: noraConversations.updatedAt })
        .from(noraConversations)
        .where(eq(noraConversations.userId, userId))
        .limit(20);
    },
    { detail: { tags: ["nora"], summary: "Get Nora conversation history" } }
  )

  // Get a specific conversation (for resuming)
  .get(
    "/conversations/:id",
    async ({ db, userId, params, set }) => {
      const [conv] = await db
        .select()
        .from(noraConversations)
        .where(eq(noraConversations.id, params.id))
        .limit(1);

      if (!conv || conv.userId !== userId) {
        set.status = 404;
        return { error: "Conversation not found" };
      }
      return conv;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["nora"], summary: "Get a specific Nora conversation" },
    }
  )

  // Generic AI completion — no VHI context, no conversation persistence.
  // Used by labInsightsService, symptomPatternRecognitionService, aiInsightsService, voiceService.
  .post(
    "/complete",
    async ({ body, set, userId }) => {
      // Per-user rate limiting — 30 completions / user / minute
      const rl = completionRateLimiter.check(userId);
      if (!rl.allowed) {
        const retryAfterSecs = Math.ceil((rl.resetAt - Date.now()) / 1000);
        set.status = 429;
        set.headers = {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": "30",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        };
        return { error: "Too many requests. Please wait before sending another completion.", retryAfter: retryAfterSecs };
      }

      if (!process.env.OPENAI_API_KEY?.startsWith("sk-")) {
        set.status = 503;
        return { error: "AI service is not configured. Set OPENAI_API_KEY and redeploy." };
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: body.model ?? "gpt-3.5-turbo",
          messages: body.messages,
          max_tokens: body.maxTokens ?? 1000,
          temperature: body.temperature ?? 0.7,
        }),
        signal: AbortSignal.timeout(30_000), // 30-second ceiling — same as /chat
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          set.status = 429;
          return { error: "AI quota exceeded. Please try again later." };
        }
        if (response.status === 401) {
          set.status = 503;
          return { error: "AI service is not configured. Contact support." };
        }
        console.error("[nora/complete] OpenAI error:", errorText);
        set.status = 502;
        return { error: "AI service unavailable. Please try again." };
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices[0]?.message?.content;
      if (typeof content !== "string") {
        set.status = 502;
        return { error: "Invalid response format from AI service" };
      }

      return { content };
    },
    {
      body: t.Object({
        messages: t.Array(
          t.Object({
            role: t.Union([
              t.Literal("user"),
              t.Literal("assistant"),
              t.Literal("system"),
            ]),
            content: t.String(),
          })
        ),
        model: t.Optional(t.String()),
        temperature: t.Optional(t.Number()),
        maxTokens: t.Optional(t.Number()),
        usePremiumKey: t.Optional(t.Boolean()), // accepted for API compatibility, single key on server
      }),
      detail: {
        tags: ["nora"],
        summary: "Generic AI completion (no VHI context, no persistence)",
      },
    }
  )

  // Transcribe audio using OpenAI Whisper — accepts base64-encoded audio
  .post(
    "/transcribe",
    async ({ body, set, userId }) => {
      // Per-user rate limiting — 10 transcriptions / user / minute
      // Whisper is billed per second of audio; tighter limit prevents cost abuse.
      const rl = transcribeRateLimiter.check(userId);
      if (!rl.allowed) {
        const retryAfterSecs = Math.ceil((rl.resetAt - Date.now()) / 1000);
        set.status = 429;
        set.headers = {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        };
        return { error: "Too many transcription requests. Please wait before sending another.", retryAfter: retryAfterSecs };
      }

      if (!process.env.OPENAI_API_KEY?.startsWith("sk-")) {
        set.status = 503;
        return { error: "AI service is not configured. Set OPENAI_API_KEY and redeploy." };
      }

      // Decode base64 to binary
      const audioBuffer = Buffer.from(body.audioBase64, "base64");

      // Build multipart form data for Whisper API
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: body.mimeType });
      formData.append("file", blob, body.filename);
      formData.append("model", "whisper-1");
      if (body.language) {
        formData.append("language", body.language);
      }

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
        // 60-second ceiling — Whisper processing time scales with audio length
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[nora/transcribe] Whisper error:", errorText);
        set.status = 502;
        return { error: "Transcription service unavailable. Please try again." };
      }

      const data = (await response.json()) as { text?: string };
      return { text: data.text ?? "" };
    },
    {
      body: t.Object({
        audioBase64: t.String(),
        filename: t.String(),
        mimeType: t.String(),
        language: t.Optional(t.String()),
        usePremiumKey: t.Optional(t.Boolean()), // accepted for API compatibility
      }),
      detail: {
        tags: ["nora"],
        summary: "Transcribe audio via OpenAI Whisper (base64 input)",
      },
    }
  )

  // Health / configuration check — tells mobile if OPENAI_API_KEY is set
  .get(
    "/health",
    () => {
      const configured = Boolean(
        process.env.OPENAI_API_KEY?.startsWith("sk-")
      );
      return { configured, timestamp: new Date().toISOString() };
    },
    { detail: { tags: ["nora"], summary: "Nora configuration health check" } }
  )

  // ── Chat Sessions ──────────────────────────────────────────────────────────

  /**
   * POST /api/nora/chat-sessions
   * Create a new AI chat session record.
   */
  .post(
    "/chat-sessions",
    async ({ db, userId, body }) => {
      const id = crypto.randomUUID();
      // Sessions are stored in noraConversations using the conversationId pattern
      const now = new Date().toISOString();
      const messages = (body.messages ?? []).map((m: { role: string; content: string; timestamp?: string }) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        timestamp: m.timestamp ?? now,
      }));
      await db.insert(noraConversations).values({
        id,
        userId,
        messages,
        vhiVersionAtStart: null,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [noraConversations.id],
        set: { messages, updatedAt: new Date() },
      });
      return { id };
    },
    {
      body: t.Object({
        messages: t.Optional(t.Array(t.Object({
          role: t.String(),
          content: t.String(),
          timestamp: t.Optional(t.String()),
        }))),
        title: t.Optional(t.String()),
      }),
      detail: { tags: ["nora"], summary: "Create or upsert a Nora chat session" },
    }
  )

  /**
   * PATCH /api/nora/chat-sessions/:id
   * Append messages to an existing chat session.
   */
  .patch(
    "/chat-sessions/:id",
    async ({ db, userId, params, body }) => {
      const now = new Date().toISOString();
      const newMessages = (body.messages ?? []).map((m: { role: string; content: string; timestamp?: string }) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        timestamp: m.timestamp ?? now,
      }));
      await db.update(noraConversations)
        .set({ messages: newMessages, updatedAt: new Date() })
        .where(and(eq(noraConversations.id, params.id), eq(noraConversations.userId, userId)));
      return { ok: true };
    },
    {
      body: t.Object({
        messages: t.Optional(t.Array(t.Object({
          role: t.String(),
          content: t.String(),
          timestamp: t.Optional(t.String()),
        }))),
        title: t.Optional(t.String()),
        updatedAt: t.Optional(t.String()),
      }),
      detail: { tags: ["nora"], summary: "Update a Nora chat session" },
    }
  )

  /**
   * POST /api/nora/realtime-session
   * Generate an OpenAI Realtime API ephemeral client secret for WebRTC sessions.
   * Replaces the old "openaiRealtimeClientSecret" Cloud Function.
   */
  .post(
    "/realtime-session",
    async ({ body, userId, set }) => {
      // Per-user rate limiting — 5 Realtime session tokens / user / minute
      // (Realtime sessions are billed by the minute of audio)
      const rl = realtimeSessionRateLimiter.check(userId);
      if (!rl.allowed) {
        const retryAfterSecs = Math.ceil((rl.resetAt - Date.now()) / 1000);
        set.status = 429;
        set.headers = {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        };
        return { error: "Too many session requests. Please wait before starting a new session.", retryAfter: retryAfterSecs };
      }

      const model = body.model ?? "gpt-4o-realtime-preview-2024-12-17";
      const apiKey = body.usePremiumKey
        ? (process.env.OPENAI_PREMIUM_API_KEY ?? process.env.OPENAI_API_KEY)
        : process.env.OPENAI_API_KEY;

      const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, voice: "alloy" }),
        signal: AbortSignal.timeout(15_000), // Realtime session creation should be fast
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 429) {
          set.status = 429;
          return { error: "AI quota exceeded. Please try again in a moment." };
        }
        console.error("[nora/realtime-session] OpenAI error:", response.status, err);
        set.status = 502;
        return { error: "Realtime service temporarily unavailable. Please try again." };
      }

      const data = (await response.json()) as { client_secret?: { value: string; expires_at: number } };
      return {
        clientSecret: data.client_secret?.value ?? null,
        expiresAt: data.client_secret?.expires_at ?? null,
      };
    },
    {
      body: t.Object({
        model: t.Optional(t.String()),
        usePremiumKey: t.Optional(t.Boolean()),
      }),
      detail: { tags: ["nora"], summary: "Generate OpenAI Realtime ephemeral client secret" },
    }
  );
