import * as Sentry from "@sentry/react-native";

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

export const routingInstrumentation = Sentry.reactNavigationIntegration();

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

  Sentry.init({
    dsn: "https://3c10b6c7baa9d0cd68ececd5fc353a0b@o4510873580470272.ingest.us.sentry.io/4510873582501888",

    beforeSendTransaction(event) {
      event.transaction = sanitizeTransactionName(event.transaction);
      return event;
    },

    sendDefaultPii: true,
    enableLogs: true,

    // Tracing (set to 1.0 for verification, tune down for production)
    tracesSampleRate: 1.0,

    enableUserInteractionTracing: true,

    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [
      Sentry.reactNativeTracingIntegration(),
      routingInstrumentation,
      Sentry.mobileReplayIntegration(),
      Sentry.feedbackIntegration(),
    ],
  });
}

// Initialize on import (for index.js side-effect import).
ensureSentryInitialized();
