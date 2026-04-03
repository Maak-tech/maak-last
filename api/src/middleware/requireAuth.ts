import { Elysia, error } from "elysia";
import { auth } from "../lib/auth";
import { db } from "../db";

// Middleware that validates Better-auth session and injects userId + db into context
export const requireAuth = new Elysia({ name: "require-auth" })
  .decorate("db", db)
  .derive(
    { as: "global" },
    async ({ request, set }) => {
      const session = await auth.api.getSession({ headers: request.headers });

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
