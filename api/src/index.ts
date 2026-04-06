import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { authRoutes } from "./routes/auth";
import { vhiRoutes } from "./routes/vhi";
import { healthRoutes } from "./routes/health";
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

// ── Startup environment validation ─────────────────────────────────────────────
// Fail fast at boot rather than serving requests that silently fail because a
// secret or connection string is missing. Required vars are the minimal set
// whose absence guarantees a broken API — optional integrations (Tigris, Twilio,
// ML service) are allowed to be absent and gracefully degraded by their callers.
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",     // Neon Postgres connection string
  "BETTER_AUTH_SECRET", // better-auth session signing key
  "JWT_SECRET",       // hospital staff JWT signing key
] as const;

const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(
    `[startup] Missing required environment variables: ${missingEnvVars.join(", ")}\n` +
    `         Copy .env.example to .env and fill in the values before starting the server.`
  );
  process.exit(1);
}

// parseInt with radix 10; fall back to 3000 if PORT is unset or non-numeric.
// Number(process.env.PORT) would silently produce NaN for strings like "auto".
const _portRaw = parseInt(process.env.PORT ?? "", 10);
const PORT = Number.isNaN(_portRaw) ? 3000 : _portRaw;
const IS_PROD = process.env.NODE_ENV === "production";

const app = new Elysia()
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
  // Liveness probe — returns ok even if DB is down (keeps the process running)
  .get("/health", async ({ db, query }) => {
    const result: Record<string, unknown> = {
      status: "ok",
      timestamp: new Date().toISOString(),
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
      console.error("[ready] DB ping failed:", err instanceof Error ? err.message : String(err));
      set.status = 503;
      return { status: "unavailable" };
    }
  })
  // Route groups
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
  // Global error handler
  .onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found" };
    }
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Validation error", details: error.message };
    }
    console.error("[API Error]", error instanceof Error ? error.message : String(error));
    set.status = 500;
    return { error: "Internal server error" };
  })
  .listen(PORT);

console.info(`Nuralix API running on http://localhost:${PORT}`);
if (!IS_PROD) console.info(`Docs: http://localhost:${PORT}/swagger`);

// ── Graceful shutdown ──────────────────────────────────────────────────────────
// Railway sends SIGTERM before forcibly killing the process.
// Elysia's .stop() closes the HTTP server so in-flight requests can drain
// before the process exits.  Without this, Railway's rolling deployments would
// drop active connections instantly on every deploy.
function shutdown(signal: string) {
  console.info(`[shutdown] Received ${signal} — stopping server…`);
  app.stop();
  // Give in-flight requests up to 10 s to complete, then exit.
  // Bun does not yet expose a "drain completed" callback on the HTTP server,
  // so a fixed timeout is the current best practice.
  setTimeout(() => {
    console.info("[shutdown] Graceful timeout reached — exiting.");
    process.exit(0);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

export type App = typeof app;
