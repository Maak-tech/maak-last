import { router } from "expo-router";

/**
 * Guards paywall access. Can be used as a plain function call or via the
 * object API (.tryShowPaywall / .hidePaywall) used by the premium screen.
 */

let _paywallVisible = false;

export const paywallGuard = Object.assign(
  // Callable as paywallGuard(isSubscribed) – redirects to premium if not subscribed
  function paywallGuard(isSubscribed: boolean): boolean {
    if (!isSubscribed) {
      router.push({ pathname: '/(settings)/premium' });
      return false;
    }
    return true;
  },
  {
    /**
     * Returns true if the paywall can be shown (not already visible).
     * Sets internal flag so duplicate opens are prevented.
     */
    tryShowPaywall(): boolean {
      if (_paywallVisible) return false;
      _paywallVisible = true;
      return true;
    },

    /** Marks the paywall as hidden so tryShowPaywall can fire again. */
    hidePaywall(): void {
      _paywallVisible = false;
    },
  }
);
