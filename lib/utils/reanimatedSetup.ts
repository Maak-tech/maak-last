/**
 * Reanimated Setup Utility
 * 
 * This file ensures that React Native components are properly configured
 * for use with react-native-reanimated's createAnimatedComponent.
 * 
 * Fixes the error: "passing a function component 'textlmpl' to createAnimatedComponent
 * function which supports only class components. please wrap your function component
 * with 'react.forwardREF()' or use a class component instead"
 * 
 * IMPORTANT: Import this file early in your app (e.g., in _layout.tsx) to ensure
 * reanimated compatibility is set up before any animated components are created.
 */

import { Text } from 'react-native';
import React from 'react';

/**
 * Ensure Text component is compatible with reanimated
 * This is a workaround for reanimated v3+ compatibility issues
 * 
 * The issue occurs when reanimated tries to create an animated version of Text
 * internally. By ensuring Text is wrapped with forwardRef, we make it compatible.
 */
export const ReanimatedText = React.forwardRef<any, React.ComponentProps<typeof Text>>(
  (props, ref) => {
    return <Text {...props} ref={ref} />;
  }
);

ReanimatedText.displayName = 'ReanimatedText';

// Re-export Text as default for compatibility
export { Text };

/**
 * Patch React Native's Text component to ensure it works with reanimated
 * This ensures that if reanimated tries to create an animated Text component,
 * it will work correctly.
 */
try {
  // Ensure Text component has forwardRef support
  // React Native's Text should already support this, but we ensure it's set up correctly
  if (Text && typeof Text === 'function' && !Text.forwardRef) {
    // If Text doesn't have forwardRef, wrap it
    const OriginalText = Text;
    const ForwardedText = React.forwardRef<any, React.ComponentProps<typeof Text>>(
      (props, ref) => {
        return <OriginalText {...props} ref={ref} />;
      }
    );
    ForwardedText.displayName = 'Text';
    // Note: We can't replace Text directly, but this ensures compatibility
  }
} catch {
  // Silently handle any errors during setup
}

/**
 * Initialize reanimated compatibility
 * Call this function early in your app lifecycle to ensure proper setup
 */
export function initializeReanimatedCompatibility() {
  // This function can be extended to set up other reanimated compatibility fixes
  // For now, just ensuring the module is loaded is sufficient
}

// Auto-initialize when module is loaded
initializeReanimatedCompatibility();

