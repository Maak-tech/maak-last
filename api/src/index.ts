import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
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
        : true,
      credentials: true,
    })
  )
  .use(
    swagger({
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
        ],
      },
    })
  )
  // Inject db into context for all routes
  .decorate("db", db)
  // Health check
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
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
    console.error("[API Error]", error);
    set.status = 500;
    return { error: "Internal server error" };
  })
  .listen(PORT);

console.log(`Nuralix API running on http://localhost:${PORT}`);
console.log(`Docs: http://localhost:${PORT}/swagger`);

export type App = typeof app;
