/**
 * Expo Push Notification helpers — server-side.
 *
 * Sends notifications via Expo Push Service (exp.host/--/api/v2/push/send).
 * Push tokens are stored in the `push_tokens` Neon table.
 *
 * PHI rule: NEVER include raw health values (vitals, diagnoses, meds) in
 * notification bodies — send generic prompts only.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { familyMembers, pushTokens, users } from "../db/schema";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Badge count to show on the app icon (iOS only) */
  badge?: number;
  /** Sound — 'default' or null to suppress sound */
  sound?: "default" | null;
  /** Notification priority */
  priority?: "default" | "normal" | "high";
}

// ── Quiet hours ───────────────────────────────────────────────────────────────

/**
 * Returns true if now falls within the user's configured quiet hours.
 * Quiet hours are stored in the user's preferences.notifications.quietHours:
 *   { enabled: boolean, startHour: number (0-23), endHour: number (0-23), timezone: string }
 *
 * During quiet hours, low-priority pushes are suppressed.
 * Critical and high-priority pushes bypass quiet hours entirely.
 */
async function isInQuietHours(userId: string, priority?: string): Promise<boolean> {
  // Critical alerts always go through — never suppress emergency notifications
  if (priority === 'high' || priority === 'critical') return false;

  try {
    // Import db lazily to avoid circular dependency
    const { db } = await import('../db');
    const { users } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    const [user] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId)).limit(1);
    const quietHours = (user?.preferences as Record<string, unknown> | null)?.notifications as Record<string, unknown> | null;
    const qh = quietHours?.quietHours as { enabled?: boolean; startHour?: number; endHour?: number; timezone?: string } | null;

    if (!qh?.enabled) return false;

    const tz = qh.timezone ?? 'UTC';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz });
    const currentHour = parseInt(formatter.format(now), 10);

    const start = qh.startHour ?? 22;
    const end = qh.endHour ?? 7;

    if (start <= end) {
      return currentHour >= start && currentHour < end;
    } else {
      // Overnight window (e.g. 22:00 → 07:00)
      return currentHour >= start || currentHour < end;
    }
  } catch {
    return false; // On error, never suppress
  }
}

// ── Core delivery ─────────────────────────────────────────────────────────────

/**
 * Send a push notification to a single user.
 * Looks up all active Expo push tokens for the userId and sends to all of them
 * (the same user may have multiple devices).
 */
export async function pushToUser(userId: string, msg: PushMessage): Promise<void> {
  if (await isInQuietHours(userId, msg.priority)) {
    console.info(`[push] Suppressed notification for user ${userId} — quiet hours active`);
    return;
  }

  const tokens = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)));

  if (tokens.length === 0) return;
  await deliverToTokens(tokens.map((t) => t.token), msg);
}

/**
 * Send a push notification to all *admin* members of a user's family.
 * Used by vhiCycle to alert caregivers when a family member's risk is elevated.
 *
 * @param memberUserId  The user whose family admins should be notified
 * @param msg           The notification payload (no raw PHI)
 */
export async function pushToFamilyAdmins(memberUserId: string, msg: PushMessage): Promise<void> {
  // 1. Find what family this user belongs to
  const memberships = await db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, memberUserId));

  if (memberships.length === 0) return;

  const familyIds = memberships.map((m) => m.familyId);

  // 2. Get all admin members in those families (excluding the patient themselves)
  const adminRows = await db
    .select({ userId: familyMembers.userId })
    .from(familyMembers)
    .where(
      and(
        inArray(familyMembers.familyId, familyIds),
        eq(familyMembers.role, "admin")
      )
    );

  const adminIds = adminRows
    .map((r) => r.userId)
    .filter((id) => id !== memberUserId);

  if (adminIds.length === 0) return;

  // 3. Fetch their active push tokens
  const tokens = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(
      and(
        inArray(pushTokens.userId, adminIds),
        eq(pushTokens.isActive, true)
      )
    );

  if (tokens.length === 0) return;
  await deliverToTokens(tokens.map((t) => t.token), msg);
}

/**
 * Send to both the patient AND all their family admins.
 * Used for compositeRisk >= 75 alerts per the plan.
 */
export async function pushToUserAndFamilyAdmins(
  userId: string,
  userMsg: PushMessage,
  adminMsg: PushMessage
): Promise<void> {
  await Promise.all([
    pushToUser(userId, userMsg),
    pushToFamilyAdmins(userId, adminMsg),
  ]);
}

// ── Internal delivery helper ──────────────────────────────────────────────────

async function deliverToTokens(tokens: string[], msg: PushMessage): Promise<void> {
  const messages = tokens.map((token) => ({
    to: token,
    title: msg.title,
    body: msg.body,
    data: msg.data ?? {},
    sound: msg.sound ?? "default",
    priority: msg.priority ?? "high",
    ...(msg.badge !== undefined ? { badge: msg.badge } : {}),
  }));

  const accessToken = process.env.EXPO_ACCESS_TOKEN;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(15_000), // Expo Push API must respond within 15 s
    });

    if (!res.ok) {
      console.error(`[push] Expo Push API responded ${res.status}:`, await res.text().catch(() => ""));
    }
  } catch (err: unknown) {
    console.error("[push] Failed to deliver notifications:", err instanceof Error ? err.message : String(err));
  }
}

// ── Name lookup ───────────────────────────────────────────────────────────────

/** Returns display name for a userId, used to personalize caregiver alerts. */
export async function getUserDisplayName(userId: string): Promise<string> {
  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.name ?? "your family member";
}
