import { router } from "expo-router";

/**
 * Checks if the user has an active subscription.
 * If not, redirects to the paywall screen.
 * Returns true if access is granted, false if redirected.
 */
export function paywallGuard(isSubscribed: boolean): boolean {
  if (!isSubscribed) {
    router.push("/(settings)/premium" as any);
    return false;
  }
  return true;
}
