import { Elysia, error } from "elysia";
import { auth } from "../lib/auth";
import { db } from "../db";

// Middleware that validates Better-auth session and injects userId + db into context.
//
// IMPORTANT: use `.resolve()`, NOT `.derive()`.
// In Elysia, `.derive()` always merges its return value into the context and does NOT
// short-circuit the request pipeline. `.resolve()` is the correct lifecycle hook for
// "validate + inject" scenarios — it explicitly terminates the request when you return
// an error() response, preventing downstream handlers from running with an undefined userId.
export const requireAuth = new Elysia({ name: "require-auth" })
  .decorate("db", db)
  .resolve(
    { as: "global" },
    async ({ request }) => {
      let session: Awaited<ReturnType<typeof auth.api.getSession>>;
      try {
        session = await auth.api.getSession({ headers: request.headers });
      } catch (err: unknown) {
        // Auth service threw (e.g., DB connection error during session lookup).
        // Return 401 instead of 500 — the client should re-authenticate.
        console.error("[requireAuth] getSession threw:", err);
        return error(401, { error: "Unauthorized" });
      }

      if (!session) {
        return error(401, { error: "Unauthorized" });
      }

      return {
        session,
        userId: session.user.id,
        userEmail: session.user.email,
      };
    }
  );
