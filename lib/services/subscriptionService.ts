/**
 * Subscription service — Phase 11.
 *
 * Reads the current user's plan and entitlements from the Nuralix API,
 * which syncs from RevenueCat (native IAP) via the webhook bridge.
 *
 * The app should call `subscriptionService.getMyPlan()` to gate premium features
 * instead of calling RevenueCat SDK directly — this keeps entitlement logic
 * server-side and consistent across mobile and web.
 *
 * For native IAP purchases, RevenueCat SDK is still used on-device to initiate
 * the payment flow, but the resulting entitlement is synced to Neon via the
 * RevenueCat webhook → `POST /webhooks/revenuecat`.
 */

import { api } from "@/lib/apiClient";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanName = "free" | "individual" | "family" | "org";
export type PlanStatus = "active" | "expired" | "cancelled" | "trial";

export type Subscription = {
  plan: PlanName;
  status: PlanStatus;
  currentPeriodEnd: string | null;
  /** True when the subscription is active and not expired. */
  isActive: boolean;
};

// Feature → required plan mapping
const FEATURE_PLANS: Record<string, PlanName[]> = {
  vhi: ["individual", "family", "org"],
  genetics: ["individual", "family", "org"],
  nora_chat: ["individual", "family", "org"],
  family_dashboard: ["family", "org"],
  clinical_notes: ["individual", "family", "org"],
  sdk_access: ["org"],
};

// ── Service ───────────────────────────────────────────────────────────────────

class SubscriptionService {
  private _cache: { data: Subscription; fetchedAt: number } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get the current user's subscription details.
   * Results are cached for 5 minutes to avoid hammering the API.
   */
  async getMyPlan(forceRefresh = false): Promise<Subscription> {
    if (
      !forceRefresh &&
      this._cache &&
      Date.now() - this._cache.fetchedAt < this.CACHE_TTL_MS
    ) {
      return this._cache.data;
    }

    try {
      const raw = await api.get<{
        plan: PlanName;
        status: PlanStatus;
        currentPeriodEnd: string | null;
      }>("/api/subscriptions/me");

      const data: Subscription = {
        ...raw,
        isActive: raw.status === "active" || raw.status === "trial",
      };

      this._cache = { data, fetchedAt: Date.now() };
      return data;
    } catch {
      // If the endpoint fails (user has no subscription row yet), return free plan
      const freePlan: Subscription = {
        plan: "free",
        status: "active",
        currentPeriodEnd: null,
        isActive: true,
      };
      this._cache = { data: freePlan, fetchedAt: Date.now() };
      return freePlan;
    }
  }

  /**
   * Check if the current user's plan grants access to a specific feature.
   */
  async canAccess(feature: keyof typeof FEATURE_PLANS): Promise<boolean> {
    const requiredPlans = FEATURE_PLANS[feature];
    if (!requiredPlans) return true; // unknown feature — allow by default

    const sub = await this.getMyPlan();
    if (!sub.isActive) return false;
    return (requiredPlans as string[]).includes(sub.plan);
  }

  /** Invalidate the cache (call after a purchase is confirmed). */
  invalidateCache(): void {
    this._cache = null;
  }
}

export const subscriptionService = new SubscriptionService();
export default subscriptionService;
