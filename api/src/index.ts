import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "./db";
import { logger } from "./lib/logger.js";
import { initSentry, Sentry } from "./lib/sentry.js";
import { openAICircuitBreaker } from "./lib/circuitBreaker.js";
import { startVHIRealtimeWorker } from "./jobs/vhiRealtimeWorker.js";
import { authRoutes } from "./routes/auth";
import { vhiRoutes } from "./routes/vhi";
import { healthRoutes } from "./routes/health/index.js";
import { familyRoutes } from "./routes/family";
import { geneticsRoutes } from "./routes/genetics";
import { notificationRoutes } from "./routes/notifications";
import { realtimeRoutes } from "./routes/realtime";
import { sdkRoutes } from "./routes/sdk";
import { noraRoutes } from "./routes/nora";
import { clinicalNotesRoutes } from "./routes/clinicalNotes";
import { emergencyRoutes } from "./routes/emergency";
import { auditRoutes } from "./routes/audit";
import { webhookRoutes } from "./routes/webhooks";
import { subscriptionRoutes } from "./routes/subscriptions";
import { userRoutes, usersRoutes } from "./routes/user";
import { alertsRoutes } from "./routes/alerts";
import { calendarRoutes } from "./routes/calendar";
import { taskRoutes } from "./routes/tasks";
import { orgRoutes } from "./routes/org";
import { clinicalRoutes } from "./routes/clinical";
import { consentRoutes } from "./routes/consent";
import { integrationRoutes } from "./routes/integrations";
import { searchRoutes } from "./routes/search";
import { medicationRoutes } from "./routes/medications";
import { featureFlagRoutes } from "./routes/featureFlags";
import { phiAuditLogger } from "./middleware/auditLogger.js";

// ── Startup environment validation ─────────────────────────────────────────────
// Fail fast at boot rather than serving requests that silently fail because a
// secret or connection string is missing. Required vars are the minimal set
// whose absence guarantees a broken API — optional integrations (Tigris, Twilio,
// ML service) are allowed to be absent and gracefully degraded by their callers.
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",          // Neon Postgres connection string
  "BETTER_AUTH_SECRET",    // better-auth session signing key
  "JWT_SECRET",            // hospital staff JWT signing key
  "TOKEN_ENCRYPTION_KEY",  // AES-256 key for encrypting stored OAuth tokens
] as const;

// Optional — not required for boot but should be set in production:
//   SENTRY_DSN  — enables Sentry error reporting; silently skipped when absent

const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  logger.error(
    { missingVars: missingEnvVars },
    `[startup] Missing required environment variables: ${missingEnvVars.join(", ")}. ` +
    `Copy .env.example to .env and fill in the values before starting the server.`
  );
  process.exit(1);
}

// parseInt with radix 10; fall back to 3000 if PORT is unset or non-numeric.
// Number(process.env.PORT) would silently produce NaN for strings like "auto".
// Sentry must be initialised before any route or job is registered so that
// unhandled errors during startup are captured.
initSentry();

// Start the VHI realtime worker (pg LISTEN on vhi_recompute channel).
// Errors here are non-fatal to the HTTP server — log and continue.
startVHIRealtimeWorker().catch((err) =>
  logger.error({ err }, 'VHI realtime worker failed to start')
);

const _portRaw = parseInt(process.env.PORT ?? "", 10);
const PORT = Number.isNaN(_portRaw) ? 3000 : _portRaw;
const IS_PROD = process.env.NODE_ENV === "production";

const app = new Elysia({
  serve: {
    maxRequestBodySize: 10 * 1024 * 1024, // 10 MB
  },
})
  .use(
    cors({
      origin: IS_PROD
        ? ["https://app.nuralix.ai", "https://nuralix.ai"]
        // Explicit allowlist instead of `true` (reflect any origin) to prevent
        // credentialed cross-origin requests from arbitrary origins in dev/staging.
        : ["http://localhost:3000", "http://localhost:8081", "http://localhost:19006", "exp://localhost:8081"],
      credentials: true,
    })
  )
  // Swagger UI is only served in non-production environments to prevent API surface
  // enumeration. In production this is a no-op Elysia plugin (returns 404 for /swagger).
  .use(
    IS_PROD
      ? new Elysia()
      : swagger({
          documentation: {
            info: {
              title: "Nuralix API",
              version: "1.0.0",
              description: "Virtual Health Identity platform API",
            },
            tags: [
              { name: "auth", description: "Authentication" },
              { name: "vhi", description: "Virtual Health Identity" },
              { name: "health", description: "Health data (vitals, symptoms, medications, clinical notes)" },
              { name: "family", description: "Family management and caregiver dashboard" },
              { name: "genetics", description: "DNA and genomic analysis" },
              { name: "nora", description: "Nora AI assistant" },
              { name: "sdk", description: "Third-party SDK endpoints" },
              { name: "emergency", description: "Emergency SMS alerts" },
              { name: "audit", description: "HIPAA audit trail" },
              { name: "webhooks", description: "RevenueCat + Autumn billing webhooks" },
              { name: "subscriptions", description: "Plan and entitlement state" },
              { name: "user", description: "User profile and preferences" },
              { name: "alerts", description: "Emergency alerts CRUD" },
              { name: "calendar", description: "Calendar events" },
              { name: "tasks", description: "Org/caregiver task management" },
              { name: "org", description: "Organization management" },
              { name: "clinical", description: "Clinical integration requests" },
              { name: "consent", description: "Patient consent management" },
              { name: "integrations", description: "Third-party health provider integrations (Withings, Fitbit, Oura, etc.)" },
              { name: "search", description: "Full-text search across user health records" },
              { name: "medications", description: "Medication refill workflows" },
            ],
          },
        })
  )
  // Inject db into context for all routes
  .decorate("db", db)
  // ── Request ID & structured request logging ──────────────────────────────────
  .derive(({ request }) => ({
    requestId: request.headers.get('x-request-id') ?? randomUUID(),
  }))
  .onRequest(({ request, set, requestId }) => {
    set.headers['x-request-id'] = requestId as string;
    logger.info({ requestId, method: request.method, url: request.url }, 'incoming request');
  })
  .onAfterResponse(({ request, set, requestId }) => {
    logger.info({ requestId, method: request.method, url: request.url, status: set.status }, 'response sent');
  })
  // Automatic PHI audit trail — fire-and-forget, never blocks the response
  .onAfterResponse(phiAuditLogger)
  // Liveness probe — returns ok even if DB is down (keeps the process running)
  .get("/health", async ({ db, query }) => {
    const result: Record<string, unknown> = {
      status: "ok",
      version: "1",
      apiVersions: ["v1"],
      legacySupport: true,
      timestamp: new Date().toISOString(),
      services: {
        openai: openAICircuitBreaker.getState(),  // 'closed' | 'open' | 'half-open'
      },
    };
    // ?jobs=true — include cron job heartbeat status for monitoring dashboards
    if (query.jobs === "true") {
      try {
        const { jobHeartbeats } = await import("./db/schema");
        const rows = await db.select().from(jobHeartbeats);
        const now = Date.now();
        result.jobs = rows.map((r) => {
          const msSinceRun = now - r.lastRunAt.getTime();
          const expectedMs = r.expectedIntervalSeconds * 1000;
          return {
            name: r.jobName,
            status: r.status,
            lastRunAt: r.lastRunAt.toISOString(),
            minutesAgo: Math.round(msSinceRun / 60_000),
            healthy: msSinceRun < expectedMs * 2,
            runCount: r.runCount,
          };
        });
      } catch {
        result.jobs = "unavailable";
      }
    }
    return result;
  })
  // Readiness probe — verifies DB connectivity before Railway routes traffic here.
  // Returns 503 if the database is unreachable so the load balancer can failover.
  .get("/ready", async ({ db, set }) => {
    try {
      await db.execute(sql`SELECT 1`);
      return { status: "ready" };
    } catch (err: unknown) {
      logger.error({ err }, "[ready] DB ping failed");
      set.status = 503;
      return { status: "unavailable" };
    }
  })
  // ── API versioning ─────────────────────────────────────────────────────────────
  // All route modules export Elysia plugins without a base prefix — just path
  // segments like /auth, /vitals.  The prefix is applied at mount time so the
  // same handlers can be registered under both /api/v1/ and the legacy /api/
  // namespace without duplicating logic.
  //
  // v1 routes: /api/v1/<resource>
  .use(
    new Elysia({ prefix: "/api/v1" })
      .onAfterResponse(({ request, set, requestId }) => {
        logger.info({ requestId, method: request.method, url: request.url, version: "v1" }, "v1 response sent");
      })
      .use(authRoutes)
      .use(vhiRoutes)
      .use(healthRoutes)
      .use(familyRoutes)
      .use(geneticsRoutes)
      .use(notificationRoutes)
      .use(realtimeRoutes)
      .use(sdkRoutes)
      .use(noraRoutes)
      .use(clinicalNotesRoutes)
      .use(emergencyRoutes)
      .use(auditRoutes)
      .use(webhookRoutes)
      .use(subscriptionRoutes)
      .use(userRoutes)
      .use(usersRoutes)
      .use(alertsRoutes)
      .use(calendarRoutes)
      .use(taskRoutes)
      .use(orgRoutes)
      .use(clinicalRoutes)
      .use(consentRoutes)
      .use(integrationRoutes)
      .use(searchRoutes)
      .use(medicationRoutes)
      .use(featureFlagRoutes)
  )
  // Legacy routes: /api/<resource> — kept for backwards compatibility with older
  // mobile app versions that have not yet migrated to /api/v1/.  These will be
  // removed once all supported app versions use the v1 prefix.
  .use(
    new Elysia({ prefix: "/api" })
      .onAfterResponse(({ request, set, requestId }) => {
        // Stamp deprecation headers so clients know to upgrade.
        set.headers["Deprecation"] = "true";
        set.headers["Link"] = '</api/v1>; rel="successor-version"';
        logger.info({ requestId, method: request.method, url: request.url, version: "legacy" }, "legacy response sent");
      })
      .use(authRoutes)
      .use(vhiRoutes)
      .use(healthRoutes)
      .use(familyRoutes)
      .use(geneticsRoutes)
      .use(notificationRoutes)
      .use(realtimeRoutes)
      .use(sdkRoutes)
      .use(noraRoutes)
      .use(clinicalNotesRoutes)
      .use(emergencyRoutes)
      .use(auditRoutes)
      .use(webhookRoutes)
      .use(subscriptionRoutes)
      .use(userRoutes)
      .use(usersRoutes)
      .use(alertsRoutes)
      .use(calendarRoutes)
      .use(taskRoutes)
      .use(orgRoutes)
      .use(clinicalRoutes)
      .use(consentRoutes)
      .use(integrationRoutes)
      .use(searchRoutes)
      .use(medicationRoutes)
      .use(featureFlagRoutes)
  )
  // Global error handler
  .onError(({ code, error, set, requestId }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found" };
    }
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Validation error", details: error.message };
    }
    // Capture unexpected errors in Sentry (no-op when SENTRY_DSN is unset)
    Sentry.captureException(error, { extra: { requestId } });
    logger.error({ requestId, err: error }, "unhandled error");
    set.status = 500;
    return { error: "Internal server error" };
  })
  .listen(PORT);

logger.info({ port: PORT }, `Nuralix API running on http://localhost:${PORT}`);
if (!IS_PROD) logger.info({ docsUrl: `http://localhost:${PORT}/swagger` }, `Docs: http://localhost:${PORT}/swagger`);

// ── Graceful shutdown ──────────────────────────────────────────────────────────
// Railway sends SIGTERM before forcibly killing the process.
// Elysia's .stop() closes the HTTP server so in-flight requests can drain
// before the process exits.  Without this, Railway's rolling deployments would
// drop active connections instantly on every deploy.
function shutdown(signal: string) {
  logger.info({ signal }, `[shutdown] Received ${signal} — stopping server…`);
  app.stop();
  // Give in-flight requests up to 10 s to complete, then exit.
  // Bun does not yet expose a "drain completed" callback on the HTTP server,
  // so a fixed timeout is the current best practice.
  setTimeout(() => {
    logger.info("[shutdown] Graceful timeout reached — exiting.");
    process.exit(0);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

export type App = typeof app;
