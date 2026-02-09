/**
 * Global Error Handler for React Native
 * Captures JavaScript errors before they cause native crashes
 */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: global error pipeline intentionally prioritizes resiliency over minimal branching. */
/* biome-ignore-all lint/complexity/noVoid: fire-and-forget telemetry calls intentionally ignore returned promises. */
/* biome-ignore-all lint/suspicious/noExplicitAny: runtime global/error surfaces are loosely typed in React Native environment hooks. */
/* biome-ignore-all lint/correctness/noUndeclaredVariables: ErrorUtils is injected by React Native runtime when available. */

import { Platform } from "react-native";
import { isFirebaseReady } from "@/lib/firebase";
import { observabilityEmitter } from "@/lib/observability";
import { logger } from "./logger";

// Store original handlers
let originalErrorHandler: ((error: Error, isFatal?: boolean) => void) | null =
  null;
let originalPromiseRejectionHandler:
  | ((event: PromiseRejectionEvent) => void)
  | null = null;

/**
 * Enhanced error handler that logs errors before they crash the app
 * This wraps the TextImpl patch handler to ensure all errors are logged
 */
function handleGlobalError(error: Error, isFatal = false) {
  try {
    const errorMessage = error?.message || String(error || "");

    // Let TextImpl patch handle TextImpl-specific errors first
    // (it will suppress them if they're TextImpl errors)
    if (
      errorMessage.includes("TextImpl") &&
      (errorMessage.includes("createAnimatedComponent") ||
        errorMessage.includes("forwardRef") ||
        errorMessage.includes("function component"))
    ) {
      // This is a TextImpl error - let the original handler deal with it
      // (it will suppress it)
      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
      return;
    }

    const stack = error?.stack ? error.stack.slice(0, 2000) : undefined;

    // For all other errors, log them before passing to original handler
    const errorDetails = {
      message: errorMessage,
      stack,
      name: error?.name,
      isFatal,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    };

    logger.error("Global Error Handler", errorDetails, "ErrorHandler");

    // Log to console for debugging
    console.error("=== GLOBAL ERROR HANDLER ===");
    console.error("Error:", error);
    console.error("Is Fatal:", isFatal);
    console.error("Stack:", error?.stack);
    console.error("===========================");

    // Forward fatal errors to Firestore-based observability for production visibility.
    try {
      if (isFirebaseReady()) {
        const emit =
          isFatal &&
          typeof observabilityEmitter.emitImmediatePlatformEvent === "function"
            ? observabilityEmitter.emitImmediatePlatformEvent
            : observabilityEmitter.emitPlatformEvent;

        void emit(
          isFatal ? "js_fatal_error" : "js_error",
          errorMessage || "Unknown JS error",
          {
            source: "error_handler",
            severity: isFatal ? "critical" : "error",
            status: "failure",
            error: {
              code: error?.name,
              message: errorMessage || "Unknown JS error",
              stack,
            },
            metadata: {
              eventType: isFatal ? "fatal" : "non_fatal",
              source: "global_error_handler",
              stack,
            },
          }
        );
      }
    } catch (reportError) {
      logger.error(
        "Failed to report global error to observability",
        reportError,
        "ErrorHandler"
      );
    }

    // Call original handler if it exists (this is the TextImpl handler)
    if (originalErrorHandler) {
      originalErrorHandler(error, isFatal);
    }
  } catch (handlerError) {
    // If error handler itself fails, log to console as last resort
    console.error("Error handler failed:", handlerError);
    console.error("Original error:", error);
  }
}

/**
 * Handle unhandled promise rejections
 */
function handleUnhandledRejection(event: PromiseRejectionEvent | any) {
  try {
    const error =
      event?.reason || event?.error || new Error("Unhandled Promise Rejection");
    const stack = error?.stack ? error.stack.slice(0, 2000) : undefined;
    const errorDetails = {
      message: error?.message || String(error),
      stack,
      name: error?.name,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
      type: "unhandled_promise_rejection",
    };

    logger.error("Unhandled Promise Rejection", errorDetails, "ErrorHandler");

    console.error("=== UNHANDLED PROMISE REJECTION ===");
    console.error("Error:", error);
    console.error("Event:", event);
    console.error("===================================");

    // Forward unhandled rejections to Firestore-based observability.
    try {
      if (isFirebaseReady()) {
        void observabilityEmitter.emitPlatformEvent(
          "js_unhandled_rejection",
          error?.message || "Unhandled Promise Rejection",
          {
            source: "error_handler",
            severity: "error",
            status: "failure",
            error: {
              code: error?.name,
              message: error?.message || "Unhandled Promise Rejection",
              stack,
            },
            metadata: {
              eventType: "unhandled_promise_rejection",
              source: "promise_rejection_handler",
              stack,
            },
          }
        );
      }
    } catch (reportError) {
      logger.error(
        "Failed to report promise rejection to observability",
        reportError,
        "ErrorHandler"
      );
    }

    // Call original handler if it exists
    if (originalPromiseRejectionHandler) {
      originalPromiseRejectionHandler(event);
    }
  } catch (handlerError) {
    console.error("Promise rejection handler failed:", handlerError);
    console.error("Original rejection:", event);
  }
}

/**
 * Initialize global error handlers
 * Call this early in app initialization (before any other code runs)
 * Note: This should be called AFTER textImplPatch.js sets up its handler
 * so we wrap the existing handler
 */
export function initializeErrorHandlers() {
  // Only initialize once
  if (originalErrorHandler !== null) {
    return;
  }

  // Set up React Native error handler
  // Get the current handler (might be from textImplPatch.js)
  if (typeof ErrorUtils !== "undefined" && ErrorUtils.setGlobalHandler) {
    const currentHandler = ErrorUtils.getGlobalHandler();

    // If there's already a handler, wrap it
    if (currentHandler && currentHandler !== handleGlobalError) {
      originalErrorHandler = currentHandler;
    }

    // Set our handler (which will call the original if it exists)
    ErrorUtils.setGlobalHandler(handleGlobalError);
  }

  // Set up promise rejection handler
  if (typeof global !== "undefined") {
    // Store original if it exists
    originalPromiseRejectionHandler =
      (global as any).onunhandledrejection || null;

    // Set new handler
    (global as any).onunhandledrejection = handleUnhandledRejection;

    // Also handle Node.js style unhandled rejections
    if (typeof process !== "undefined" && process.on) {
      process.on("unhandledRejection", (reason: any) => {
        handleUnhandledRejection({ reason, error: reason });
      });
    }
  }

  logger.info("Global error handlers initialized", {}, "ErrorHandler");
}

/**
 * Restore original error handlers (useful for testing)
 */
export function restoreErrorHandlers() {
  if (originalErrorHandler && typeof ErrorUtils !== "undefined") {
    ErrorUtils.setGlobalHandler(originalErrorHandler);
  }

  if (originalPromiseRejectionHandler && typeof global !== "undefined") {
    (global as any).onunhandledrejection = originalPromiseRejectionHandler;
  }

  originalErrorHandler = null;
  originalPromiseRejectionHandler = null;
}
