/**
 * VHI (Virtual Health Identity) client service.
 *
 * Wraps the Nuralix API `/api/vhi` endpoints so the mobile app can read
 * the current user's live health identity without touching Firebase.
 *
 * The VHI is computed server-side every 15 minutes by `vhiCycle.ts` and
 * contains the full health picture: current state, risk scores, elevating
 * factors, declining factors, and pending actions.
 */

import { api } from "@/lib/apiClient";
import type { VirtualHealthIdentity } from "@/types/vhi";

// ── Re-export canonical types ─────────────────────────────────────────────────
// Consumers that `import { ElevatingFactor } from "@/lib/services/vhiService"`
// continue to work without changes.
export type {
  VHIDimension,
  RiskComponent,
  VHIAction,
  ElevatingFactor,
  DecliningFactor,
  VirtualHealthIdentity,
} from "@/types/vhi";

// ── Named alias for the genetic baseline sub-shape ────────────────────────────
// Kept as a named export so callers can reference it without importing the
// full VirtualHealthIdentity shape.
export type VHIGeneticBaseline = NonNullable<VirtualHealthIdentity["geneticBaseline"]>;

// ── VHI wrapper returned by the API ──────────────────────────────────────────
// The server wraps the VirtualHealthIdentity document in a thin envelope that
// adds `updatedAt` and keeps the identity data in a `data` field.
export type VHIData = VirtualHealthIdentity;

export type VHI = {
  userId: string;
  version: number;
  computedAt: string | null;
  data: VirtualHealthIdentity;
  updatedAt: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

class VHIService {
  /**
   * Fetch the current user's Virtual Health Identity.
   * Returns `null` if the VHI has not been computed yet.
   */
  async getMyVHI(): Promise<VHI | null> {
    try {
      return await api.get<VHI | null>("/api/vhi/me");
    } catch {
      return null;
    }
  }

  /**
   * Fetch a family member's Virtual Health Identity.
   * The requesting user must be a family admin of that member.
   * Returns `null` if not found or not authorized.
   */
  async getMemberVHI(memberId: string): Promise<VHI | null> {
    try {
      return await api.get<VHI | null>(`/api/vhi/${memberId}`);
    } catch {
      return null;
    }
  }

  /**
   * Acknowledge a pending VHI action so it no longer surfaces to the user.
   */
  async acknowledgeAction(actionId: string): Promise<boolean> {
    try {
      const result = await api.post<{ ok: boolean }>(
        `/api/vhi/me/actions/${actionId}/acknowledge`,
        {}
      );
      return result.ok;
    } catch {
      return false;
    }
  }

  /**
   * Request an immediate VHI recompute (fires the vhiCycle for this user).
   * The VHI will update within ~60 seconds.
   */
  async requestRecompute(): Promise<void> {
    try {
      await api.post("/api/vhi/me/recompute", {});
    } catch {
      // Non-critical
    }
  }

  /**
   * Build a proactive opening message for Nora based on the user's top
   * declining factors. Returns `undefined` if there's nothing notable.
   *
   * Priority order:
   *   1. First HIGH-impact declining factor
   *   2. First MEDIUM-impact declining factor
   *   3. First urgent pending action
   */
  getProactiveMessage(
    vhi: VHI,
    isRTL: boolean
  ): string | undefined {
    const { decliningFactors, pendingActions } = vhi.data ?? {};

    // 1. Top high-impact declining factor
    const topHigh = (decliningFactors ?? []).find((f) => f.impact === "high");
    if (topHigh) {
      return isRTL
        ? `لاحظت تغيراً يؤثر على صحتك: ${topHigh.factor}. هل تريد مناقشة ذلك؟`
        : `I noticed something affecting your health: ${topHigh.factor}. Would you like to discuss it?`;
    }

    // 2. First medium-impact declining factor
    const topMedium = (decliningFactors ?? []).find((f) => f.impact === "medium");
    if (topMedium) {
      return isRTL
        ? `لديك بعض المؤشرات الصحية التي تستحق الانتباه — ${topMedium.factor}. أخبرني إذا كنت تريد مزيداً من التوضيح.`
        : `There are some health patterns worth noting — ${topMedium.factor}. Let me know if you'd like to dig in.`;
    }

    // 3. Urgent unacknowledged action
    const urgentAction = (pendingActions ?? []).find(
      (a) => a.priority === "urgent" && !a.acknowledged
    );
    if (urgentAction) {
      return isRTL
        ? `هناك إجراء مهم يحتاج اهتمامك: ${urgentAction.title}`
        : `There's an important action that needs your attention: ${urgentAction.title}`;
    }

    return undefined;
  }

  /**
   * Format an overall health score label for display.
   * Returns a string like "Good (74/100)" or "High risk (82/100)".
   */
  formatScoreLabel(score: number | undefined, isRTL: boolean): string {
    if (score === undefined || score === null) {
      return isRTL ? "غير متاح" : "Not available";
    }
    if (score >= 75) return isRTL ? `جيد (${score}/100)` : `Good (${score}/100)`;
    if (score >= 50) return isRTL ? `متوسط (${score}/100)` : `Fair (${score}/100)`;
    return isRTL ? `يحتاج اهتماماً (${score}/100)` : `Needs attention (${score}/100)`;
  }
}

export const vhiService = new VHIService();
export default vhiService;
