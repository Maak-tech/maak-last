/* biome-ignore-all lint/suspicious/noExplicitAny: Callable boundary validates inputs at runtime for compatibility. */
import { https } from "firebase-functions";
import { onCall } from "firebase-functions/v2/https";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";
import {
  getSecretValue,
  OPENAI_API_KEY,
  REVENUECAT_SECRET_API_KEY,
  ZEINA_API_KEY,
} from "../secrets";

type ChatRole = "system" | "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

const FAMILY_PLAN_ENTITLEMENT = (
  process.env.REVENUECAT_ENTITLEMENT_ID || "Family Plan of 4"
).trim();

const LEADING_SLASH_RE = /^\//;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const asNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return;
  }
  return value;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function requireAuth(request: { auth?: { uid?: string } | null }) {
  if (!request.auth?.uid) {
    throw new https.HttpsError("unauthenticated", "User must be authenticated");
  }
}

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<
      string,
      {
        expires_date?: string | null;
        product_identifier?: string;
        purchase_date?: string | null;
      }
    >;
  };
};

const revenueCatEntitlementCache = new Map<
  string,
  { hasAccess: boolean; checkedAtMs: number }
>();

async function hasActiveFamilyPlanEntitlement(
  uid: string,
  traceId: string
): Promise<boolean> {
  const cached = revenueCatEntitlementCache.get(uid);
  const now = Date.now();
  if (cached && now - cached.checkedAtMs < 60_000) {
    return cached.hasAccess;
  }

  const revenueCatSecret = getSecretValue(
    REVENUECAT_SECRET_API_KEY,
    process.env.REVENUECAT_SECRET_API_KEY
  );

  if (!revenueCatSecret) {
    logger.warn("RevenueCat secret not configured; denying AI access", {
      traceId,
      uid,
      fn: "openaiProxy.hasActiveFamilyPlanEntitlement",
    });
    revenueCatEntitlementCache.set(uid, { hasAccess: false, checkedAtMs: now });
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${revenueCatSecret}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.warn("RevenueCat subscriber lookup failed", {
        traceId,
        uid,
        status: response.status,
        body: text.slice(0, 500),
        fn: "openaiProxy.hasActiveFamilyPlanEntitlement",
      });
      revenueCatEntitlementCache.set(uid, {
        hasAccess: false,
        checkedAtMs: now,
      });
      return false;
    }

    const json = (await response.json()) as RevenueCatSubscriberResponse;
    const entitlement =
      json.subscriber?.entitlements?.[FAMILY_PLAN_ENTITLEMENT];
    if (!entitlement) {
      revenueCatEntitlementCache.set(uid, {
        hasAccess: false,
        checkedAtMs: now,
      });
      return false;
    }

    // RevenueCat uses ISO strings for expiry; missing/empty expiry typically indicates lifetime.
    const expiresDate = entitlement.expires_date;
    if (!expiresDate) {
      revenueCatEntitlementCache.set(uid, {
        hasAccess: true,
        checkedAtMs: now,
      });
      return true;
    }

    const expiresAtMs = Date.parse(expiresDate);
    const hasAccess = Number.isFinite(expiresAtMs) && expiresAtMs > now;
    revenueCatEntitlementCache.set(uid, { hasAccess, checkedAtMs: now });
    return hasAccess;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("RevenueCat entitlement check error", {
      traceId,
      uid,
      message,
      fn: "openaiProxy.hasActiveFamilyPlanEntitlement",
    });
    revenueCatEntitlementCache.set(uid, { hasAccess: false, checkedAtMs: now });
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requireFamilyPlan(request: { auth?: { uid?: string } | null }) {
  requireAuth(request);
  const uid = request.auth?.uid;
  if (!uid) {
    throw new https.HttpsError("unauthenticated", "User must be authenticated");
  }
  const traceId = createTraceId();

  const hasAccess = await hasActiveFamilyPlanEntitlement(uid, traceId);
  if (!hasAccess) {
    throw new https.HttpsError(
      "permission-denied",
      "This feature requires an active Family Plan subscription."
    );
  }
}

function selectOpenAIKey(usePremiumKey: boolean): string {
  const zeinaKey = getSecretValue(ZEINA_API_KEY, process.env.ZEINA_API_KEY);
  const openaiKey = getSecretValue(OPENAI_API_KEY, process.env.OPENAI_API_KEY);

  const preferred = usePremiumKey ? zeinaKey : openaiKey;
  const fallback = usePremiumKey ? openaiKey : zeinaKey;
  const key = preferred || fallback;

  if (!key) {
    throw new https.HttpsError(
      "failed-precondition",
      "OpenAI is not configured on the server. Set Firebase Functions secret OPENAI_API_KEY (and optionally ZEINA_API_KEY), then redeploy."
    );
  }

  return key;
}

async function openaiFetchJson(
  traceId: string,
  path: string,
  apiKey: string,
  body: unknown
): Promise<Response> {
  const url = `https://api.openai.com/v1/${path.replace(LEADING_SLASH_RE, "")}`;
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    logger.error("OpenAI fetch failed", error as Error, {
      traceId,
      url,
      fn: "openaiProxy.openaiFetchJson",
    });
    throw new https.HttpsError("unavailable", "Could not reach OpenAI API");
  }
}

async function readOpenAIErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      return parsed.error?.message || text || `HTTP ${response.status}`;
    } catch {
      return text || `HTTP ${response.status}`;
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}

function throwOpenAIHttpError(params: {
  status: number;
  message: string;
}): never {
  if (params.status === 401) {
    throw new https.HttpsError(
      "failed-precondition",
      "OpenAI credentials are invalid or missing on the server"
    );
  }
  if (params.status === 429) {
    throw new https.HttpsError(
      "resource-exhausted",
      "OpenAI rate limit or quota exceeded"
    );
  }
  throw new https.HttpsError("internal", `OpenAI API error: ${params.message}`);
}

function normalizeChatMessages(rawMessages: unknown): ChatMessage[] {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    throw new https.HttpsError(
      "invalid-argument",
      "messages must be a non-empty array"
    );
  }
  if (rawMessages.length > 40) {
    throw new https.HttpsError("invalid-argument", "Too many messages");
  }

  const messages: ChatMessage[] = [];
  for (const raw of rawMessages) {
    const obj =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    const role = obj?.role;
    const content = obj?.content;

    if (!(role === "system" || role === "user" || role === "assistant")) {
      throw new https.HttpsError("invalid-argument", "Invalid message role");
    }
    if (!isNonEmptyString(content)) {
      throw new https.HttpsError(
        "invalid-argument",
        "Message content must be a non-empty string"
      );
    }
    if (content.length > 8000) {
      throw new https.HttpsError(
        "invalid-argument",
        "Message content too long"
      );
    }

    messages.push({ role, content });
  }

  return messages;
}

function readChatCompletionContent(json: unknown): string {
  const obj = json as { choices?: Array<{ message?: { content?: string } }> };
  const content = obj.choices?.[0]?.message?.content;
  if (!isNonEmptyString(content)) {
    throw new https.HttpsError(
      "internal",
      "Invalid response format from OpenAI"
    );
  }
  return content;
}

export const openaiHealthCheck = onCall(
  {
    secrets: [OPENAI_API_KEY, ZEINA_API_KEY, REVENUECAT_SECRET_API_KEY],
  },
  async (request) => {
    requireAuth(request);
    const traceId = createTraceId();
    const uid = request.auth?.uid;
    if (!uid) {
      throw new https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const openaiKey = getSecretValue(
      OPENAI_API_KEY,
      process.env.OPENAI_API_KEY
    );
    const zeinaKey = getSecretValue(ZEINA_API_KEY, process.env.ZEINA_API_KEY);

    const hasAccess = await hasActiveFamilyPlanEntitlement(uid, traceId);

    logger.debug("OpenAI health check", {
      traceId,
      configured: Boolean(openaiKey || zeinaKey),
      hasAccess,
      fn: "openaiHealthCheck",
    });

    return {
      configured: Boolean(openaiKey || zeinaKey),
      hasAccess,
    };
  }
);

export const openaiChatCompletion = onCall(
  {
    secrets: [OPENAI_API_KEY, ZEINA_API_KEY, REVENUECAT_SECRET_API_KEY],
  },
  async (request) => {
    await requireFamilyPlan(request);
    const traceId = createTraceId();

    const data = request.data || {};
    const usePremiumKey = Boolean((data as any).usePremiumKey);
    const model = isNonEmptyString((data as any).model)
      ? (data as any).model
      : "gpt-4o-mini";
    const temperature = clamp(
      asNumberOrUndefined((data as any).temperature) ?? 0.7,
      0,
      2
    );
    const maxTokens = clamp(
      asNumberOrUndefined((data as any).maxTokens) ?? 800,
      1,
      2000
    );

    const messages = normalizeChatMessages((data as any).messages);

    const apiKey = selectOpenAIKey(usePremiumKey);

    const response = await openaiFetchJson(
      traceId,
      "/chat/completions",
      apiKey,
      {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }
    );

    if (!response.ok) {
      const message = await readOpenAIErrorMessage(response);
      logger.warn("OpenAI chat completion failed", {
        traceId,
        status: response.status,
        message,
        fn: "openaiChatCompletion",
      });
      throwOpenAIHttpError({ status: response.status, message });
    }

    const json = (await response.json()) as unknown;
    const content = readChatCompletionContent(json);

    return { content };
  }
);

export const openaiTranscribeAudio = onCall(
  {
    secrets: [OPENAI_API_KEY, ZEINA_API_KEY, REVENUECAT_SECRET_API_KEY],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    await requireFamilyPlan(request);
    const traceId = createTraceId();

    const data = request.data || {};
    const usePremiumKey = Boolean((data as any).usePremiumKey);
    const audioBase64 = (data as any).audioBase64;
    const filename = isNonEmptyString((data as any).filename)
      ? (data as any).filename
      : "audio.m4a";
    const mimeType = isNonEmptyString((data as any).mimeType)
      ? (data as any).mimeType
      : "audio/m4a";
    const language = isNonEmptyString((data as any).language)
      ? (data as any).language
      : undefined;

    if (!isNonEmptyString(audioBase64)) {
      throw new https.HttpsError(
        "invalid-argument",
        "audioBase64 must be provided"
      );
    }

    const apiKey = selectOpenAIKey(usePremiumKey);

    let audioBytes: Uint8Array;
    try {
      audioBytes = Uint8Array.from(Buffer.from(audioBase64, "base64"));
    } catch {
      throw new https.HttpsError(
        "invalid-argument",
        "audioBase64 is not valid base64"
      );
    }

    // Best-effort size guard (callable payload limits vary; this is a safety valve).
    if (audioBytes.byteLength > 8 * 1024 * 1024) {
      throw new https.HttpsError("invalid-argument", "Audio payload too large");
    }

    const form = new FormData();
    form.append("model", "whisper-1");
    if (language) {
      form.append("language", language);
    }

    const blob = new Blob([Buffer.from(audioBytes)], { type: mimeType });
    form.append("file", blob, filename);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      });
    } catch (error) {
      logger.error("OpenAI whisper fetch failed", error as Error, {
        traceId,
        fn: "openaiTranscribeAudio",
      });
      throw new https.HttpsError("unavailable", "Could not reach OpenAI API");
    }

    if (!response.ok) {
      const message = await readOpenAIErrorMessage(response);
      logger.warn("OpenAI transcription failed", {
        traceId,
        status: response.status,
        message,
        fn: "openaiTranscribeAudio",
      });
      throwOpenAIHttpError({ status: response.status, message });
    }

    const json = (await response.json()) as { text?: string };
    const text = typeof json.text === "string" ? json.text.trim() : "";
    return { text };
  }
);

export const openaiRealtimeClientSecret = onCall(
  {
    secrets: [OPENAI_API_KEY, ZEINA_API_KEY, REVENUECAT_SECRET_API_KEY],
  },
  async (request) => {
    await requireFamilyPlan(request);
    const traceId = createTraceId();

    const data = request.data || {};
    const usePremiumKey = Boolean((data as any).usePremiumKey);
    const model =
      (isNonEmptyString((data as any).model)
        ? (data as any).model
        : undefined) || "gpt-4o-realtime-preview";

    const apiKey = selectOpenAIKey(usePremiumKey);

    const response = await openaiFetchJson(
      traceId,
      "/realtime/client_secrets",
      apiKey,
      {
        expires_after: {
          anchor: "created_at",
          seconds: 600,
        },
        session: {
          type: "realtime",
          model,
        },
      }
    );

    if (!response.ok) {
      const message = await readOpenAIErrorMessage(response);
      logger.warn("OpenAI realtime client secret failed", {
        traceId,
        status: response.status,
        message,
        fn: "openaiRealtimeClientSecret",
      });
      throwOpenAIHttpError({ status: response.status, message });
    }

    const json = (await response.json()) as {
      value?: string;
      expires_at?: number;
    };
    const value = json.value;
    const expiresAt = json.expires_at;
    if (!isNonEmptyString(value)) {
      throw new https.HttpsError(
        "internal",
        "Invalid response format from OpenAI"
      );
    }

    logger.info("Issued realtime client secret", {
      traceId,
      hasExpiry: typeof expiresAt === "number",
      fn: "openaiRealtimeClientSecret",
    });

    return { clientSecret: value, expiresAt };
  }
);
