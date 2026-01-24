/**
 * Global paywall guard utility
 * Prevents multiple paywalls from showing simultaneously
 */
class PaywallGuard {
  private isShowing = false;

  /**
   * Check if a paywall is currently showing
   */
  isPaywallShowing(): boolean {
    return this.isShowing;
  }

  /**
   * Set paywall showing state
   */
  setPaywallShowing(showing: boolean): void {
    this.isShowing = showing;
  }

  /**
   * Try to show paywall - returns true if allowed, false if already showing
   */
  tryShowPaywall(): boolean {
    if (this.isShowing) {
      return false;
    }
    this.isShowing = true;
    return true;
  }

  /**
   * Hide paywall
   */
  hidePaywall(): void {
    this.isShowing = false;
  }
}

export const paywallGuard = new PaywallGuard();
