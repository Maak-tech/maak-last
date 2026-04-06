import { Elysia, t } from "elysia";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/requireAuth";
import { requirePremium } from "../middleware/requirePremium.js";
import { logger } from "../lib/logger.js";
import { openAICircuitBreaker } from "../lib/circuitBreaker.js";
import { OPENAI_CONFIGURED } from "../lib/openai.js";
import { applyNoraGuardrails } from "../lib/noraGuardrails.js";
import { vhi, noraConversations, noraMessageFeedback, vitals, symptoms, moods, medications } from "../db/schema";
import { chatRateLimiter, completionRateLimiter, realtimeSessionRateLimiter, transcribeRateLimiter } from "../lib/rateLimiter";
import type { Database } from "../db";

const NORA_SYSTEM_CONSTRAINTS = `

CRITICAL RULES — follow without exception:
1. NEVER diagnose. Never state a user has, may have, or is at risk for a specific medical condition.
2. NEVER recommend medication changes, dosage adjustments, or stopping medications.
3. ALWAYS suggest consulting a doctor for symptoms, medications, or abnormal readings.
4. NEVER express certainty about health outcomes.
5. If the user describes emergency symptoms (chest pain, difficulty breathing, sudden weakness, fainting, seizure), respond ONLY with the emergency services message.
6. Your role: help users understand their tracked data and encourage healthy habits — not to interpret clinical significance.`

/**
 * Builds the Nora system prompt from VHI context and health-data availability.
 * Extracted so both /chat and /chat/stream share identical prompt logic.
 */
function buildNoraSystemPrompt(vhiContext: string, hasData: boolean): string {
  const noDataPreamble = !hasData
    ? [
        "",
        "## IMPORTANT: No health data connected yet",
        "This user has not yet logged any health data (no vitals, symptoms, moods, or medications).",
        "Do NOT make up or infer any personal health numbers, trends, risk scores, or baselines.",
        "Instead, warmly welcome them and guide them to connect their first data source:",
        "  1. Log a vital (blood pressure, heart rate, weight) using the '+' button",
        "  2. Connect Apple Health or Google Health Connect in Settings → Integrations",
        "  3. Add a medication or symptom to get started",
        "You MAY answer general health education questions. You MUST NOT give personalised health advice without data.",
      ].join("\n")
    : "";

  return [
    "You are Nora, Nuralix's AI health assistant.",
    "You help users understand their Virtual Health Identity — what's helping their health and what's hurting it.",
    "You explain health signals in plain language, connect patterns to their personal baseline, and guide them to the right next step.",
    "You do not diagnose. You explain, support, and guide.",
    "",
    "## Safety Rules — NEVER violate these",
    "1. NEVER tell a user to stop, skip, reduce, or change the dose of any medication — always say 'please speak with your doctor or pharmacist before making any changes to your medication.'",
    "2. NEVER recommend a specific medication, supplement, or treatment to a user.",
    "3. NEVER interpret a lab result, vital, or symptom as a definitive diagnosis — you can describe what is above/below their baseline, but you must NOT say 'this means you have [condition]'.",
    "4. If a user asks whether they should stop or change a medication, respond with: 'I can't advise on medication changes — please contact your doctor or pharmacist directly. If this is urgent, call emergency services.'",
    "5. If a user expresses thoughts of self-harm or suicide, respond immediately with: 'I'm concerned about what you've shared. Please reach out to a crisis helpline right now — in the US call or text 988, or go to your nearest emergency room. I'm here with you.'",
    "6. NEVER provide specific dosage information or suggest that a dose is safe or unsafe.",
    "7. If you are unsure whether something is safe to say, default to: 'I'd recommend discussing this with your healthcare provider to make sure you get the right guidance for your situation.'",
    "8. You may explain what a lab value or vital trend means in general terms (e.g. 'your heart rate has been trending above your personal baseline'), but always add that a clinician should interpret any significant change.",
    noDataPreamble,
    vhiContext
      ? `## Virtual Health Identity\n${vhiContext}`
      : (!hasData ? "" : "No VHI data available yet. Ask the user to log some health data first."),
    NORA_SYSTEM_CONSTRAINTS,
  ].join("\n");
}

/**
 * Persists a completed Nora conversation to Postgres (upsert by conversationId).
 * Always called non-blocking (fire-and-forget) — a failure must never degrade chat UX.
 */
function persistNoraConversation(
  db: Database,
  userId: string,
  conversationId: string,
  message: string,
  history: Array<{ role: string; content: string }>,
  reply: string,
  userVhi: { version?: number | null } | undefined
): void {
  const now = new Date().toISOString();
  const rawMessages = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      timestamp: now,
    })),
    { role: "user" as const, content: message, timestamp: now },
    { role: "assistant" as const, content: reply, timestamp: now },
  ];

  const MAX_STORED_MESSAGES = 100;
  const fullMessages =
    rawMessages.length > MAX_STORED_MESSAGES
      ? rawMessages.slice(rawMessages.length - MAX_STORED_MESSAGES)
      : rawMessages;

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
    .catch((err: unknown) => {
      logger.error({ conversationId, err }, "[nora] Failed to persist conversation");
    });
}

/**
 * Returns true when the user has at least one health data point in any of the
 * core tables (vitals, symptoms, moods, medications).  Used to gate Nora from
 * giving health-specific advice before the user has connected any data source.
 *
 * Checks four tables in parallel — we only need at least one row in any table.
 */
async function userHasHealthData(db: Database, userId: string): Promise<boolean> {
  const [v, s, m, med] = await Promise.all([
    db.select({ id: vitals.id }).from(vitals).where(eq(vitals.userId, userId)).limit(1),
    db.select({ id: symptoms.id }).from(symptoms).where(eq(symptoms.userId, userId)).limit(1),
    db.select({ id: moods.id }).from(moods).where(eq(moods.userId, userId)).limit(1),
    db.select({ id: medications.id }).from(medications).where(and(eq(medications.userId, userId), isNull(medications.deletedAt))).limit(1),
  ]);
  return v.length > 0 || s.length > 0 || m.length > 0 || med.length > 0;
}

export const noraRoutes = new Elysia({ prefix: "/api/nora" })
  .use(requireAuth)

  // Chat with Nora — sends a message and gets a response.
  // Nora receives the full VHI context block for informed, personalised responses.
  .post(
    "/chat",
    async ({ db, userId, body, set }) => {
      // Guard: fail fast if key is missing so the client gets a meaningful error
      if (!OPENAI_CONFIGURED) {
        set.status = 503;
        return { error: "AI service not configured" };
      }

      // Per-user rate limiting — 20 GPT-4o calls / user / minute
      const rl = await chatRateLimiter.check(userId);
      if (!rl.allowed) {
        const retryAfterSecs = Math.ceil(rl.resetIn / 1000);
        set.status = 429;
        set.headers = {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((Date.now() + rl.resetIn) / 1000)),
        };
        return { error: "Too many requests. Please wait before sending another message.", retryAfter: retryAfterSecs };
      }

      // Fetch current VHI context and check whether the user has any health data
      const [[userVhi], hasData] = await Promise.all([
        db.select().from(vhi).where(eq(vhi.userId, userId)).limit(1),
        userHasHealthData(db, userId),
      ]);
      const vhiContext = userVhi?.data?.noraContextBlock ?? "";
      const systemPrompt = buildNoraSystemPrompt(vhiContext, hasData);

      // Call OpenAI — wrapped in a graceful fallback so network/service errors
      // return a chat-shaped 200 instead of a 5xx crash visible to the mobile client.
      const conversationIdEarly = body.conversationId ?? crypto.randomUUID();
      let reply: string;

      // Circuit breaker: skip OpenAI entirely while the circuit is open
      if (openAICircuitBreaker.isOpen) {
        logger.warn({ requestId: conversationIdEarly }, '[Nora] OpenAI circuit open — returning fallback response')
        reply = "I'm temporarily unavailable due to a service disruption. Please try again in a few minutes. If this is urgent, please contact your care team directly."
      } else {
        try {
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

          if (!openaiRes.ok) {
            const errText = await openaiRes.text().catch(() => "(unreadable)");
            const isRateLimit = openaiRes.status === 429;
            const isServiceError = openaiRes.status === 503 || openaiRes.status === 502 || openaiRes.status === 401;
            logger.error({ status: openaiRes.status, body: errText.slice(0, 300) }, "[nora/chat] OpenAI error");
            if (isRateLimit || isServiceError) {
              openAICircuitBreaker.recordFailure()
            }
            reply = isRateLimit || isServiceError
              ? "I'm having a bit of trouble connecting right now. Your health data is safe — please try asking me again in a moment."
              : "Something went wrong on my end. Please try again. If the problem persists, your care team is always available.";
          } else {
            const data = (await openaiRes.json()) as {
              choices: Array<{ message: { content: string } }>;
            };
            const rawContent =
              data.choices[0]?.message?.content ??
              "I'm unable to respond right now. Please try again.";
            openAICircuitBreaker.recordSuccess()
            const userLocale = (body as { locale?: string }).locale ?? 'en'
            const guardrailResult = applyNoraGuardrails(rawContent, body.message, userLocale)
            if (guardrailResult.isEmergency) {
              return { reply: guardrailResult.output, conversationId: conversationIdEarly }
            }
            reply = guardrailResult.output
          }
        } catch (err: unknown) {
          const isServiceUnavailable =
            err instanceof Error &&
            (err.name === "TimeoutError" ||
              err.message.includes("503") ||
              err.message.includes("timeout") ||
              err.message.includes("ECONNREFUSED") ||
              err.message.includes("rate_limit") ||
              (err as { status?: number }).status === 503 ||
              (err as { status?: number }).status === 429);

          logger.error({ err }, "[nora/chat] OpenAI call failed");
          openAICircuitBreaker.recordFailure()

          reply = isServiceUnavailable
            ? "I'm having a bit of trouble connecting right now. Your health data is safe — please try asking me again in a moment."
            : "Something went wrong on my end. Please try again. If the problem persists, your care team is always available.";
        }
      }

      // Persist conversation (async, non-blocking)
      const conversationId = conversationIdEarly;
      persistNoraConversation(db, userId, conversationId, body.message, body.history ?? [], reply, userVhi);

      return { reply, conversationId };
    },
    {
      body: t.Object({
        // Cap message length to prevent runaway token costs (≈ 500 words)
        message: t.String({ minLength: 1, maxLength: 2000 }),
        conversationId: t.Optional(t.String({ maxLength: 36 })),
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

  // SSE streaming chat endpoint — streams OpenAI tokens in real-time.
  // The client connects, receives token-by-token `chunk` events, then a `done`
  // event with the final conversationId, then the connection closes.
  .post(
    "/chat/stream",
    async ({ db, userId, body, set }) => {
      // Guard: fail fast if OpenAI key is missing
      if (!OPENAI_CONFIGURED) {
        set.status = 503;
        return { error: "AI service not configured" };
      }

      // Per-user rate limiting — shared with /chat (20 GPT-4o calls / user / minute)
      const rl = await chatRateLimiter.check(userId);
      if (!rl.allowed) {
        const retryAfterSecs = Math.ceil(rl.resetIn / 1000);
        set.status = 429;
        set.headers = {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((Date.now() + rl.resetIn) / 1000)),
        };
        return { error: "Too many requests. Please wait before sending another message.", retryAfter: retryAfterSecs };
      }

      // Fetch VHI context and health-data availability (identical to /chat)
      const [[userVhi], hasData] = await Promise.all([
        db.select().from(vhi).where(eq(vhi.userId, userId)).limit(1),
        userHasHealthData(db, userId),
      ]);
      const vhiContext = userVhi?.data?.noraContextBlock ?? "";
      const systemPrompt = buildNoraSystemPrompt(vhiContext, hasData);

      const conversationId = body.conversationId ?? crypto.randomUUID();
      const userLocale = (body as { locale?: string }).locale ?? "en";

      // SSE headers — must be set before returning the ReadableStream
      set.headers["Content-Type"] = "text/event-stream";
      set.headers["Cache-Control"] = "no-cache";
      set.headers["Connection"] = "keep-alive";
      set.headers["X-Accel-Buffering"] = "no"; // Disable nginx buffering

      // Helper: encode an SSE event as bytes
      const enc = new TextEncoder();
      const sseEvent = (payload: Record<string, unknown>): Uint8Array =>
        enc.encode(`data: ${JSON.stringify(payload)}\n\n`);

      // Circuit breaker: return a graceful error SSE when the circuit is open
      if (openAICircuitBreaker.isOpen) {
        logger.warn({ conversationId }, "[Nora/stream] OpenAI circuit open — sending error event");
        return new ReadableStream({
          start(controller) {
            controller.enqueue(sseEvent({ type: "error", message: "I'm temporarily unavailable due to a service disruption. Please try again in a few minutes." }));
            controller.close();
          },
        });
      }

      // Open a streaming request to OpenAI
      let openaiRes: Response;
      try {
        openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
            stream: true,
          }),
          // No AbortSignal — streaming can take up to 60 s for long responses
        });
      } catch (fetchErr: unknown) {
        logger.error({ err: fetchErr, conversationId }, "[nora/chat/stream] OpenAI fetch failed");
        openAICircuitBreaker.recordFailure();
        return new ReadableStream({
          start(controller) {
            controller.enqueue(sseEvent({ type: "error", message: "I'm having a bit of trouble connecting right now. Please try again in a moment." }));
            controller.close();
          },
        });
      }

      if (!openaiRes.ok) {
        const errText = await openaiRes.text().catch(() => "(unreadable)");
        const isRateLimit = openaiRes.status === 429;
        const isServiceError = openaiRes.status === 503 || openaiRes.status === 502 || openaiRes.status === 401;
        logger.error({ status: openaiRes.status, body: errText.slice(0, 300) }, "[nora/chat/stream] OpenAI error");
        if (isRateLimit || isServiceError) openAICircuitBreaker.recordFailure();
        const errMsg = isRateLimit || isServiceError
          ? "I'm having a bit of trouble connecting right now. Your health data is safe — please try asking me again in a moment."
          : "Something went wrong on my end. Please try again.";
        return new ReadableStream({
          start(controller) {
            controller.enqueue(sseEvent({ type: "error", message: errMsg }));
            controller.close();
          },
        });
      }

      // openaiRes.body is a ReadableStream of raw SSE bytes from OpenAI.
      // We consume it, parse tokens, apply guardrails at the end, then
      // forward everything to the client as our own SSE stream.
      const upstreamBody = openaiRes.body;
      if (!upstreamBody) {
        return new ReadableStream({
          start(controller) {
            controller.enqueue(sseEvent({ type: "error", message: "Streaming not supported by the upstream service." }));
            controller.close();
          },
        });
      }

      const stream = new ReadableStream({
        async start(controller) {
          const reader = upstreamBody.getReader();
          const decoder = new TextDecoder();
          let lineBuffer = "";
          let fullResponse = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // Decode the chunk; { stream: true } handles multi-byte chars split across reads
              lineBuffer += decoder.decode(value, { stream: true });

              // Process complete lines — OpenAI sends `data: ...\n\n` per token
              const lines = lineBuffer.split("\n");
              // Keep the last (potentially incomplete) line in the buffer
              lineBuffer = lines.pop() ?? "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data: ")) continue;
                const payload = trimmed.slice("data: ".length);

                // End-of-stream sentinel
                if (payload === "[DONE]") continue;

                let parsed: { choices?: Array<{ delta?: { content?: string } }> };
                try {
                  parsed = JSON.parse(payload);
                } catch {
                  continue; // Skip malformed lines
                }

                const token = parsed.choices?.[0]?.delta?.content;
                if (token) {
                  fullResponse += token;
                  controller.enqueue(sseEvent({ type: "chunk", token }));
                }
              }
            }
          } catch (readErr: unknown) {
            logger.error({ err: readErr, conversationId }, "[nora/chat/stream] Error reading OpenAI stream");
            openAICircuitBreaker.recordFailure();
            controller.enqueue(sseEvent({ type: "error", message: "Stream interrupted. Please try again." }));
            controller.close();
            return;
          }

          // Stream finished — apply guardrails to the full collected response
          openAICircuitBreaker.recordSuccess();
          const guardrailResult = applyNoraGuardrails(
            fullResponse || "I'm unable to respond right now. Please try again.",
            body.message,
            userLocale
          );

          const finalReply = guardrailResult.output;

          // If guardrails changed or replaced the output, emit a replace event so
          // the client swaps out whatever partial text it showed during streaming
          if (guardrailResult.output !== fullResponse || guardrailResult.isEmergency) {
            controller.enqueue(sseEvent({ type: "replace", content: finalReply }));
          }

          controller.enqueue(sseEvent({ type: "done", conversationId }));
          controller.close();

          // Persist conversation non-blocking — after stream is closed so the
          // client already has the done event before we hit the DB.
          persistNoraConversation(db, userId, conversationId, body.message, body.history ?? [], finalReply, userVhi);
        },
      });

      return stream;
    },
    {
      body: t.Object({
        message: t.String({ minLength: 1, maxLength: 2000 }),
        conversationId: t.Optional(t.String({ maxLength: 36 })),
        history: t.Optional(
          t.Array(
            t.Object({
              role: t.Union([t.Literal("user"), t.Literal("assistant")]),
              content: t.String({ maxLength: 4000 }),
            }),
            { maxItems: 50 }
          )
        ),
      }),
      detail: { tags: ["nora"], summary: "Chat with Nora — real-time SSE token streaming" },
    }
  )

  // Get conversation history (returns id, title, createdAt, updatedAt, messageCount)
  // Selects only metadata columns — never loads the full messages JSONB blob.
  // For conversations with hundreds of messages, loading the full blob on a list
  // endpoint would transfer megabytes of data just to render a sidebar.
  .get(
    "/conversations",
    async ({ db, userId }) => {
      const rows = await db
        .select({
          id: noraConversations.id,
          title: noraConversations.title,
          createdAt: noraConversations.createdAt,
          updatedAt: noraConversations.updatedAt,
          // SQL array length avoids deserializing the full JSONB to JS
          messageCount: sql<number>`coalesce(jsonb_array_length(${noraConversations.messages}), 0)`,
        })
        .from(noraConversations)
        .where(eq(noraConversations.userId, userId))
        .orderBy(desc(noraConversations.updatedAt))
        .limit(20);

      return rows.map((row) => ({
        id: row.id,
        title: row.title ?? "New Chat",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        messageCount: row.messageCount,
      }));
    },
    { detail: { tags: ["nora"], summary: "Get Nora conversation history" } }
  )

  // Get a specific conversation (for resuming)
  .get(
    "/conversations/:id",
    async ({ db, userId, params, set }) => {
      // Include userId in WHERE to enforce ownership at the DB level (no TOCTOU window).
      const [conv] = await db
        .select()
        .from(noraConversations)
        .where(and(eq(noraConversations.id, params.id), eq(noraConversations.userId, userId)))
        .limit(1);

      if (!conv) {
        set.status = 404;
        return { error: "Conversation not found" };
      }
      return conv;
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["nora"], summary: "Get a specific Nora conversation" },
    }
  )

  // Delete a conversation
  .delete(
    "/conversations/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db
        .select({ id: noraConversations.id })
        .from(noraConversations)
        .where(and(eq(noraConversations.id, params.id), eq(noraConversations.userId, userId)))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { error: "Conversation not found" };
      }

      await db
        .delete(noraConversations)
        .where(and(eq(noraConversations.id, params.id), eq(noraConversations.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["nora"], summary: "Delete a Nora conversation" },
    }
  )

  // Generic AI completion — no VHI context, no conversation persistence.
  // Used by labInsightsService, symptomPatternRecognitionService, aiInsightsService, voiceService.
  .post(
    "/complete",
    async ({ body, set, userId }) => {
      // Per-user rate limiting — 30 completions / user / minute
      const rl = await completionRateLimiter.check(userId);
      if (!rl.allowed) {
        const retryAfterSecs = Math.ceil(rl.resetIn / 1000);
        set.status = 429;
        set.headers = {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": "30",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((Date.now() + rl.resetIn) / 1000)),
        };
        return { error: "Too many requests. Please wait before sending another completion.", retryAfter: retryAfterSecs };
      }

      if (!process.env.OPENAI_API_KEY?.startsWith("sk-")) {
        set.status = 503;
        return { error: "AI service is not configured. Set OPENAI_API_KEY and redeploy." };
      }

      // Call OpenAI — graceful fallback returns a 200 with a safe content string
      // so callers receive a usable response even when the service is degraded.
      let completionContent: string;

      // Circuit breaker: skip OpenAI entirely while the circuit is open
      if (openAICircuitBreaker.isOpen) {
        logger.warn({ userId }, '[Nora/complete] OpenAI circuit open — returning fallback response')
        completionContent = "I'm temporarily unavailable due to a service disruption. Please try again in a few minutes. If this is urgent, please contact your care team directly."
      } else {
        try {
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
            const errorText = await response.text().catch(() => "(unreadable)");
            const isRateLimit = response.status === 429;
            const isServiceError = response.status === 503 || response.status === 502 || response.status === 401;
            logger.error({ status: response.status, body: errorText.slice(0, 300) }, "[nora/complete] OpenAI error");
            if (isRateLimit || isServiceError) {
              openAICircuitBreaker.recordFailure()
            }
            completionContent = isRateLimit || isServiceError
              ? "I'm having a bit of trouble connecting right now. Please try again in a moment."
              : "Something went wrong on my end. Please try again. If the problem persists, your care team is always available.";
          } else {
            const data = (await response.json()) as {
              choices: Array<{ message: { content: string } }>;
            };
            completionContent = data.choices[0]?.message?.content ?? "";
            if (typeof completionContent !== "string") {
              logger.error("[nora/complete] Unexpected response format from OpenAI");
              completionContent = "I'm unable to respond right now. Please try again.";
            } else {
              openAICircuitBreaker.recordSuccess()
            }
          }
        } catch (err: unknown) {
          const isServiceUnavailable =
            err instanceof Error &&
            (err.name === "TimeoutError" ||
              err.message.includes("503") ||
              err.message.includes("timeout") ||
              err.message.includes("ECONNREFUSED") ||
              err.message.includes("rate_limit") ||
              (err as { status?: number }).status === 503 ||
              (err as { status?: number }).status === 429);

          logger.error(
            { err },
            "[nora/complete] OpenAI call failed"
          );
          openAICircuitBreaker.recordFailure()

          completionContent = isServiceUnavailable
            ? "I'm having a bit of trouble connecting right now. Please try again in a moment."
            : "Something went wrong on my end. Please try again. If the problem persists, your care team is always available.";
        }
      }

      return { content: completionContent };
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
            content: t.String({ maxLength: 10000 }),
          })
        ),
        model: t.Optional(t.String({ maxLength: 100 })),
        temperature: t.Optional(t.Number({ minimum: 0, maximum: 2 })),
        maxTokens: t.Optional(t.Number({ minimum: 1, maximum: 16000 })),
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
      const rl = await transcribeRateLimiter.check(userId);
      if (!rl.allowed) {
        const retryAfterSecs = Math.ceil(rl.resetIn / 1000);
        set.status = 429;
        set.headers = {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((Date.now() + rl.resetIn) / 1000)),
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

      // Circuit breaker: skip Whisper entirely while the circuit is open
      if (openAICircuitBreaker.isOpen) {
        logger.warn({ userId }, '[Nora/transcribe] OpenAI circuit open — rejecting transcription request')
        set.status = 503;
        return { error: "Transcription service temporarily unavailable. Please try again in a few minutes." };
      }

      let response: Response;
      try {
        response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: formData,
          // 60-second ceiling — Whisper processing time scales with audio length
          signal: AbortSignal.timeout(60_000),
        });
      } catch (fetchErr: unknown) {
        const isTimeout = fetchErr instanceof Error && fetchErr.name === "TimeoutError";
        logger.error({ err: fetchErr }, "[nora/transcribe] Whisper fetch failed");
        openAICircuitBreaker.recordFailure()
        set.status = 504;
        return { error: isTimeout ? "Transcription timed out. Try a shorter clip." : "Transcription service unreachable." };
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ errorText }, "[nora/transcribe] Whisper error");
        openAICircuitBreaker.recordFailure()
        set.status = 502;
        return { error: "Transcription service unavailable. Please try again." };
      }
      openAICircuitBreaker.recordSuccess()

      const data = (await response.json()) as { text?: string };
      return { text: data.text ?? "" };
    },
    {
      body: t.Object({
        audioBase64: t.String({ maxLength: 20_000_000 }), // ~15MB base64-encoded audio
        filename: t.String({ maxLength: 255 }),
        mimeType: t.String({ maxLength: 100 }),
        language: t.Optional(t.String({ maxLength: 10 })),
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
          role: t.String({ maxLength: 20 }),
          content: t.String({ maxLength: 100_000 }),
          timestamp: t.Optional(t.String({ maxLength: 50 })),
        }), { maxItems: 500 })),
        title: t.Optional(t.String({ maxLength: 500 })),
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
    async ({ db, userId, params, body, set }) => {
      // Fetch existing session first so we can append (not replace) messages
      const [existing] = await db
        .select({ messages: noraConversations.messages })
        .from(noraConversations)
        .where(and(eq(noraConversations.id, params.id), eq(noraConversations.userId, userId)))
        .limit(1);

      if (!existing) { set.status = 404; return { error: "Session not found" }; }

      const now = new Date().toISOString();
      const appendedMessages = (body.messages ?? []).map((m: { role: string; content: string; timestamp?: string }) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        timestamp: m.timestamp ?? now,
      }));

      const existingMessages = Array.isArray(existing.messages) ? existing.messages : [];
      const merged = [...existingMessages, ...appendedMessages];

      const setValues: { messages: typeof merged; updatedAt: Date; title?: string } = {
        messages: merged,
        updatedAt: new Date(),
      };
      if (body.title !== undefined) setValues.title = body.title;

      await db.update(noraConversations)
        .set(setValues)
        .where(and(eq(noraConversations.id, params.id), eq(noraConversations.userId, userId)));
      return { ok: true };
    },
    {
      body: t.Object({
        messages: t.Optional(t.Array(t.Object({
          role: t.String({ maxLength: 20 }),
          content: t.String({ maxLength: 100_000 }),
          timestamp: t.Optional(t.String({ maxLength: 50 })),
        }), { maxItems: 500 })),
        title: t.Optional(t.String({ maxLength: 500 })),
      }),
      detail: { tags: ["nora"], summary: "Append messages to a Nora chat session" },
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
      // Premium gate — Realtime voice sessions are a paid feature
      const { allowed, reason } = await requirePremium(userId)
      if (!allowed) {
        set.status = 402  // Payment Required
        return { error: reason ?? 'Premium subscription required', code: 'PREMIUM_REQUIRED' }
      }

      // Per-user rate limiting — 5 Realtime session tokens / user / minute
      // (Realtime sessions are billed by the minute of audio)
      const rl = await realtimeSessionRateLimiter.check(userId);
      if (!rl.allowed) {
        const retryAfterSecs = Math.ceil(rl.resetIn / 1000);
        set.status = 429;
        set.headers = {
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((Date.now() + rl.resetIn) / 1000)),
        };
        return { error: "Too many session requests. Please wait before starting a new session.", retryAfter: retryAfterSecs };
      }

      // Circuit breaker: skip OpenAI entirely while the circuit is open
      if (openAICircuitBreaker.isOpen) {
        logger.warn({ userId }, '[Nora/realtime-session] OpenAI circuit open — rejecting realtime session request')
        set.status = 503;
        return { error: "Realtime AI service temporarily unavailable. Please try again in a few minutes." };
      }

      const model = body.model ?? "gpt-4o-realtime-preview-2024-12-17";
      const apiKey = body.usePremiumKey
        ? (process.env.OPENAI_PREMIUM_API_KEY ?? process.env.OPENAI_API_KEY)
        : process.env.OPENAI_API_KEY;

      let response: Response;
      try {
        response = await fetch("https://api.openai.com/v1/realtime/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model, voice: "alloy" }),
          signal: AbortSignal.timeout(15_000), // Realtime session creation should be fast
        });
      } catch (fetchErr: unknown) {
        const isTimeout = fetchErr instanceof Error && fetchErr.name === "TimeoutError";
        logger.error({ err: fetchErr }, "[nora/realtime-session] fetch failed");
        openAICircuitBreaker.recordFailure()
        set.status = 504;
        return { error: isTimeout ? "Realtime service timed out." : "Realtime service unreachable." };
      }

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 429) {
          openAICircuitBreaker.recordFailure()
          set.status = 429;
          return { error: "AI quota exceeded. Please try again in a moment." };
        }
        // Truncate OpenAI error response — may echo back request context
        logger.error({ status: response.status, errorBody: String(err).slice(0, 200) }, "[nora/realtime-session] OpenAI error");
        openAICircuitBreaker.recordFailure()
        set.status = 502;
        return { error: "Realtime service temporarily unavailable. Please try again." };
      }
      openAICircuitBreaker.recordSuccess()

      const data = (await response.json()) as { client_secret?: { value: string; expires_at: number } };
      return {
        clientSecret: data.client_secret?.value ?? null,
        expiresAt: data.client_secret?.expires_at ?? null,
      };
    },
    {
      body: t.Object({
        model: t.Optional(t.String({ maxLength: 100 })),
        usePremiumKey: t.Optional(t.Boolean()),
      }),
      detail: { tags: ["nora"], summary: "Generate OpenAI Realtime ephemeral client secret" },
    }
  )

  // ── Nora Feedback ──────────────────────────────────────────────────────────

  /**
   * POST /api/nora/feedback
   * Submit a rating and optional flag for a Nora message.
   */
  .post(
    "/feedback",
    async ({ db, userId, body, set }) => {
      if (!body?.rating || body.rating < 1 || body.rating > 5) {
        set.status = 400;
        return { error: "rating must be 1–5" };
      }

      const validFlags = ["wrong", "harmful", "unhelpful", "helpful"];
      if (body.flag && !validFlags.includes(body.flag)) {
        set.status = 400;
        return { error: `flag must be one of: ${validFlags.join(", ")}` };
      }

      await db.insert(noraMessageFeedback).values({
        id: crypto.randomUUID(),
        userId,
        conversationId: body.conversationId ?? "unknown",
        messageId: body.messageId ?? "unknown",
        rating: body.rating,
        flag: body.flag ?? null,
        reviewedByTeam: false,
        createdAt: new Date(),
      });

      return { ok: true };
    },
    {
      body: t.Object({
        conversationId: t.Optional(t.String({ maxLength: 36 })),
        messageId: t.Optional(t.String({ maxLength: 36 })),
        rating: t.Number({ minimum: 1, maximum: 5 }),
        flag: t.Optional(t.String({ maxLength: 20 })),
      }),
      detail: { tags: ["nora"], summary: "Submit feedback for a Nora message" },
    }
  );
