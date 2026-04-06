import * as Sentry from '@sentry/node'

/**
 * Initialize Sentry error tracking.
 *
 * No-ops when SENTRY_DSN is not set (local dev, CI).
 * PHI fields are stripped from request body payloads before events are sent
 * to comply with HIPAA data handling requirements.
 */
export function initSentry(): void {
  if (!process.env.SENTRY_DSN) return

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    // Low sample rate in production to limit cost; full tracing in dev/staging.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Strip PHI from request body before the event leaves the process.
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>
        const phiFields = [
          'name',
          'dateOfBirth',
          'phone',
          'email',
          'address',
          'content',
          'notes',
        ]
        for (const field of phiFields) {
          if (field in data) data[field] = '[PHI REDACTED]'
        }
      }
      return event
    },
  })
}

// Re-export Sentry so callers can use captureException without a separate import.
export { Sentry }
