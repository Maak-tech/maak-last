import {
  feedbackIntegration,
  init,
  mobileReplayIntegration,
  reactNativeTracingIntegration,
  reactNavigationIntegration,
} from "@sentry/react-native";
import type { Integration } from "@sentry/types";

type GlobalWithSentryInit = typeof globalThis & {
  __maakSentryInitialized?: boolean;
};

const globalWithSentry = globalThis as GlobalWithSentryInit;

const sanitizeTransactionName = (name: string | undefined): string => {
  if (!name) {
    return "unknown";
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return "unknown";
  }
  return trimmed.replace(/\s+/g, " ").slice(0, 200);
};

export const routingInstrumentation = reactNavigationIntegration();

const parseOptionalRate = (value: unknown): number | undefined => {
  if (typeof value !== "string") {
    return;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    return;
  }
  return Math.min(1, Math.max(0, parsed));
};

const isDevBuild =
  // React Native defines `globalThis.__DEV__` at runtime; fall back to NODE_ENV for non-RN contexts.
  (globalThis as { __DEV__?: boolean }).__DEV__ === true ||
  process.env.NODE_ENV !== "production";

const tracesSampleRate =
  parseOptionalRate(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE) ??
  (isDevBuild ? 1.0 : 0.1);

const enableReplay =
  (process.env.EXPO_PUBLIC_SENTRY_ENABLE_REPLAY || "").toLowerCase() === "true";

/**
 * Initialize Sentry as early as possible (before route modules load).
 *
 * Why this file exists:
 * - ES module imports execute before module bodies.
 * - If a crash happens during import-time evaluation (e.g. inside a polyfill),
 *   Sentry.init inside `app/_layout.tsx` will never run, and you won't see events.
 */
export function ensureSentryInitialized() {
  if (globalWithSentry.__maakSentryInitialized) {
    return;
  }

  // Mark first to avoid re-entrancy during initialization.
  globalWithSentry.__maakSentryInitialized = true;

  const configuredReplaySessionRate = parseOptionalRate(
    process.env.EXPO_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE
  );
  const configuredReplayOnErrorRate = parseOptionalRate(
    process.env.EXPO_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE
  );

  const effectiveReplaySessionRate = enableReplay
    ? (configuredReplaySessionRate ?? 0.0)
    : 0.0;

  const effectiveReplayOnErrorRate = enableReplay
    ? (configuredReplayOnErrorRate ?? (isDevBuild ? 1.0 : 0.2))
    : 0.0;

  init({
    dsn: "https://3c10b6c7baa9d0cd68ececd5fc353a0b@o4510873580470272.ingest.us.sentry.io/4510873582501888",

    beforeSendTransaction(event) {
      event.transaction = sanitizeTransactionName(event.transaction);
      return event;
    },

    sendDefaultPii: true,
    enableLogs: isDevBuild,

    // Tracing (keep high in dev; tune down for production)
    tracesSampleRate,

    enableUserInteractionTracing: isDevBuild,

    // Session Replay
    replaysSessionSampleRate: effectiveReplaySessionRate,
    replaysOnErrorSampleRate: effectiveReplayOnErrorRate,
    integrations: (() => {
      const integrations: Integration[] = [
        reactNativeTracingIntegration() as unknown as Integration,
        routingInstrumentation as unknown as Integration,
        feedbackIntegration() as unknown as Integration,
      ];

      if (
        enableReplay &&
        (effectiveReplaySessionRate > 0 || effectiveReplayOnErrorRate > 0)
      ) {
        integrations.push(mobileReplayIntegration() as unknown as Integration);
      }

      return integrations;
    })(),
  });
}

// Initialize on import (for index.js side-effect import).
ensureSentryInitialized();
