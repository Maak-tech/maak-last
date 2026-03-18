import { Elysia } from "elysia";
import { and, eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db } from "../db";
import { familyMembers } from "../db/schema";

// ── In-memory subscriber registry ────────────────────────────────────────────
// Keyed by userId. Each value is a set of send callbacks for active WS connections.
// NOTE: In a multi-instance Railway deployment, replace with Redis pub/sub.
const subscribers = new Map<string, Set<(data: unknown) => void>>();

// Track which familyIds each userId is subscribed to (for family broadcasts)
const familySubscribers = new Map<string, Set<(data: unknown) => void>>();

// ── Public broadcast helpers ──────────────────────────────────────────────────

export function broadcastToUser(userId: string, event: string, data: unknown) {
  const userSubs = subscribers.get(userId);
  if (!userSubs?.size) return;

  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  for (const send of userSubs) {
    try {
      send(message);
    } catch {
      // Client disconnected — will be cleaned up on WS close
    }
  }
}

/**
 * Broadcast an event to all active admin/caregiver subscribers of a family.
 * Also broadcasts to the member themselves (unless excludeUserId is set).
 */
export async function broadcastToFamily(
  familyId: string,
  event: string,
  data: unknown,
  excludeUserId?: string
) {
  // Look up all current family members from DB
  let memberUserIds: string[];
  try {
    const members = await db
      .select({ userId: familyMembers.userId })
      .from(familyMembers)
      .where(eq(familyMembers.familyId, familyId));
    memberUserIds = members.map((m) => m.userId);
  } catch (err) {
    console.error("[realtime] broadcastToFamily DB lookup failed:", err);
    return;
  }

  for (const userId of memberUserIds) {
    if (userId === excludeUserId) continue;
    broadcastToUser(userId, event, data);
  }

  // Also deliver to family channel subscribers
  const familySubs = familySubscribers.get(familyId);
  if (familySubs?.size) {
    const message = JSON.stringify({ event, data, familyId, timestamp: new Date().toISOString() });
    for (const send of familySubs) {
      try {
        send(message);
      } catch {
        // ignore disconnected clients
      }
    }
  }
}

/** Remove a specific send callback from a user's subscriber set. */
function unsubscribeUser(userId: string, send: (data: unknown) => void) {
  const userSubs = subscribers.get(userId);
  if (userSubs) {
    userSubs.delete(send);
    if (userSubs.size === 0) subscribers.delete(userId);
  }
}

/**
 * Register an external send callback in a user's subscriber set.
 * Used by the SDK WebSocket endpoint so B2B clients can monitor enrolled patients
 * in real time via API key auth (bypassing the user-session auth flow).
 */
export function subscribeToUser(userId: string, send: (data: unknown) => void): void {
  if (!subscribers.has(userId)) subscribers.set(userId, new Set());
  subscribers.get(userId)!.add(send);
}

/**
 * Remove an external send callback from a user's subscriber set.
 * Must be called when the SDK WebSocket closes to avoid memory leaks.
 */
export function unsubscribeFromUser(userId: string, send: (data: unknown) => void): void {
  unsubscribeUser(userId, send);
}

/** Remove a specific send callback from a family's subscriber set. */
function unsubscribeFamily(familyId: string, send: (data: unknown) => void) {
  const subs = familySubscribers.get(familyId);
  if (subs) {
    subs.delete(send);
    if (subs.size === 0) familySubscribers.delete(familyId);
  }
}

export const realtimeRoutes = new Elysia({ prefix: "/ws" })
  // VHI real-time updates for the patient's own state
  .ws("/vhi/:userId", {
    async open(ws) {
      const userId = ws.data.params.userId;

      // Validate session before subscribing
      const session = await auth.api.getSession({ headers: ws.data.request.headers });
      if (!session || session.user.id !== userId) {
        ws.close(1008, "Unauthorized");
        return;
      }

      const send = (msg: unknown) => ws.send(msg as string);

      if (!subscribers.has(userId)) subscribers.set(userId, new Set());
      subscribers.get(userId)!.add(send);

      // Store send ref on ws.data so we can clean up on close
      (ws.data as Record<string, unknown>).__send = send;

      ws.send(JSON.stringify({ event: "connected", userId, timestamp: new Date().toISOString() }));
    },
    close(ws) {
      const userId = ws.data.params.userId;
      const send = (ws.data as Record<string, unknown>).__send as ((d: unknown) => void) | undefined;
      if (send) unsubscribeUser(userId, send);
    },
    message(ws, message) {
      // Client-initiated pings
      if (message === "ping") ws.send("pong");
    },
  })

  // Family-level updates for admins (VHI changes, alerts for all members)
  .ws("/family/:familyId", {
    async open(ws) {
      const familyId = ws.data.params.familyId;

      const session = await auth.api.getSession({ headers: ws.data.request.headers });
      if (!session) {
        ws.close(1008, "Unauthorized");
        return;
      }

      // Verify the user is a member (admin or caregiver) of this family
      const [membership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.userId, session.user.id),
            eq(familyMembers.familyId, familyId)
          )
        )
        .limit(1);

      if (!membership) {
        ws.close(1008, "Not a member of this family");
        return;
      }

      const send = (msg: unknown) => ws.send(msg as string);
      if (!familySubscribers.has(familyId)) familySubscribers.set(familyId, new Set());
      familySubscribers.get(familyId)!.add(send);
      (ws.data as Record<string, unknown>).__send = send;

      ws.send(JSON.stringify({ event: "connected", familyId, role: membership.role }));
    },
    close(ws) {
      const familyId = ws.data.params.familyId;
      const send = (ws.data as Record<string, unknown>).__send as ((d: unknown) => void) | undefined;
      if (send) unsubscribeFamily(familyId, send);
    },
    message(ws, message) {
      if (message === "ping") ws.send("pong");
    },
  })

  // Alert stream — patient's personal real-time alert feed
  .ws("/alerts/:userId", {
    async open(ws) {
      const userId = ws.data.params.userId;

      const session = await auth.api.getSession({ headers: ws.data.request.headers });
      if (!session || session.user.id !== userId) {
        ws.close(1008, "Unauthorized");
        return;
      }

      const send = (msg: unknown) => ws.send(msg as string);

      // Reuse the user subscriber map — alerts are also broadcast via broadcastToUser
      if (!subscribers.has(userId)) subscribers.set(userId, new Set());
      subscribers.get(userId)!.add(send);
      (ws.data as Record<string, unknown>).__send = send;

      ws.send(JSON.stringify({ event: "connected", channel: "alerts", userId }));
    },
    close(ws) {
      const userId = ws.data.params.userId;
      const send = (ws.data as Record<string, unknown>).__send as ((d: unknown) => void) | undefined;
      if (send) unsubscribeUser(userId, send);
    },
    message(ws, message) {
      if (message === "ping") ws.send("pong");
    },
  });
