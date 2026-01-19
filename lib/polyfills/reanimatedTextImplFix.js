/**
 * CRITICAL: This file MUST be imported FIRST, before ANY other imports
 * It patches TextImpl to work with react-native-reanimated
 *
 * This fixes: "Invariant Violation: Looks like you're passing a function component
 * `TextImpl` to `createAnimatedComponent` function which supports only class components."
 */

// Patch TextImpl IMMEDIATELY when this module loads
// Use a more defensive approach to avoid interfering with React's hook system
(function patchTextImplImmediately() {
  // Use setTimeout to ensure React is fully initialized
  if (typeof setTimeout !== "undefined") {
    setTimeout(() => {
      try {
        patchTextImpl();
      } catch (error) {
        // Silently fail
      }
    }, 0);
  } else {
    // Fallback for environments without setTimeout
    try {
      patchTextImpl();
    } catch (error) {
      // Silently fail
    }
  }

  function patchTextImpl() {
    try {
      const React = require("react");
      const ReactNative = require("react-native");

      // Safety check - ensure React and ReactNative are loaded
      if (!(React && ReactNative)) {
        return;
      }

      // Ensure forwardRef exists
      if (!React.forwardRef || typeof React.forwardRef !== "function") {
        return;
      }

      // Helper to check if component is wrapped with forwardRef
      function isForwardRefComponent(component) {
        if (!component) return false;

        try {
          // Check for forwardRef markers
          if (
            React.forwardRef &&
            component.$$typeof === React.forwardRef.$$typeof
          )
            return true;
          if (
            component.render &&
            component.render.$$typeof === React.forwardRef.$$typeof
          )
            return true;
          if (component.__isForwardRef === true) return true;

          // Check if it's a class component
          if (component.prototype && component.prototype.isReactComponent)
            return true;

          // Check for React 19 memo/forwardRef combinations
          if (
            component.type &&
            component.type.$$typeof === React.forwardRef.$$typeof
          )
            return true;
        } catch {
          return false;
        }

        return false;
      }

      // Wrap component with forwardRef
      function wrapWithForwardRef(component, displayName) {
        if (!(component && React.forwardRef)) {
          return component;
        }

        if (isForwardRefComponent(component)) {
          return component;
        }

        try {
          const WrappedComponent = React.forwardRef((props, ref) =>
            React.createElement(component, { ...props, ref })
          );

          if (WrappedComponent) {
            WrappedComponent.displayName =
              displayName ||
              (component && component.displayName) ||
              (component && component.name) ||
              "WrappedComponent";
            WrappedComponent.__isForwardRef = true;

            // Preserve static properties
            if (component && typeof component === "object") {
              try {
                const keys = Object.keys(component);
                if (keys && Array.isArray(keys) && keys.length > 0) {
                  keys.forEach((key) => {
                    try {
                      if (
                        key &&
                        key !== "displayName" &&
                        key !== "prototype" &&
                        key !== "$$typeof" &&
                        key !== "render" &&
                        key !== "name"
                      ) {
                        WrappedComponent[key] = component[key];
                      }
                    } catch {
                      // Ignore errors copying properties
                    }
                  });
                }
              } catch {
                // Ignore errors getting keys
              }
            }

            return WrappedComponent;
          }
        } catch {
          // If wrapping fails, return original component
          return component;
        }

        return component;
      }

      // AGGRESSIVE: Patch TextImpl in ALL possible locations
      const patchTargets = [
        () => ReactNative.TextImpl,
        () => ReactNative.Text?.TextImpl,
        () => ReactNative.TextInput?.TextImpl,
        () => ReactNative.Text?.render?.TextImpl,
      ];

      if (
        patchTargets &&
        Array.isArray(patchTargets) &&
        patchTargets.length > 0
      ) {
        for (const getTextImpl of patchTargets) {
          try {
            if (getTextImpl && typeof getTextImpl === "function") {
              const textImpl = getTextImpl();
              if (
                textImpl &&
                typeof textImpl === "function" &&
                !isForwardRefComponent(textImpl)
              ) {
                const wrapped = wrapWithForwardRef(textImpl, "TextImpl");

                // Try to set it back in all possible locations
                try {
                  if (ReactNative.TextImpl !== undefined) {
                    ReactNative.TextImpl = wrapped;
                  }
                  if (
                    ReactNative.Text &&
                    ReactNative.Text.TextImpl !== undefined
                  ) {
                    ReactNative.Text.TextImpl = wrapped;
                  }
                  if (
                    ReactNative.TextInput &&
                    ReactNative.TextInput.TextImpl !== undefined
                  ) {
                    ReactNative.TextInput.TextImpl = wrapped;
                  }
                } catch {
                  // Can't set it, continue
                }
              }
            }
          } catch {
            // Path doesn't exist, continue
          }
        }
      }

      // Also patch Text and TextInput components themselves
      if (
        ReactNative.Text &&
        typeof ReactNative.Text === "function" &&
        !isForwardRefComponent(ReactNative.Text)
      ) {
        ReactNative.Text = wrapWithForwardRef(ReactNative.Text, "Text");
      }

      if (
        ReactNative.TextInput &&
        typeof ReactNative.TextInput === "function" &&
        !isForwardRefComponent(ReactNative.TextInput)
      ) {
        ReactNative.TextInput = wrapWithForwardRef(
          ReactNative.TextInput,
          "TextInput"
        );
      }
    } catch (error) {
      // Log error details to help debug
      // Silently fail in production - this is a polyfill, shouldn't break the app
    }
  }
})();
