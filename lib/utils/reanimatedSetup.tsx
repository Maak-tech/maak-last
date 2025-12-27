/**
 * Reanimated Setup Utility
 * 
 * This file ensures that React Native components are properly configured
 * for use with react-native-reanimated's createAnimatedComponent.
 * 
 * Fixes the error: "passing a function component 'TextImpl' or 'TextInput' to createAnimatedComponent
 * function which supports only class components. please wrap your function component
 * with 'react.forwardRef()' or use a class component instead"
 * 
 * IMPORTANT: Import this file early in your app (e.g., in _layout.tsx) to ensure
 * reanimated compatibility is set up before any animated components are created.
 */

import React from 'react';
import { Text as RNText, TextProps, TextInput as RNTextInput, TextInputProps } from 'react-native';

/**
 * Create a forwardRef-wrapped Text component for reanimated compatibility
 * This ensures that when reanimated tries to create an animated Text component,
 * it encounters a component that's compatible with createAnimatedComponent.
 */
const TextWithForwardRef = React.forwardRef<React.ElementRef<typeof RNText>, TextProps>(
  (props, ref) => {
    return <RNText {...props} ref={ref} />;
  }
);

TextWithForwardRef.displayName = 'Text';

/**
 * Patch React Native's Text component at the module level
 * This is a workaround for react-native-reanimated v3+ compatibility issues.
 * 
 * The issue occurs when reanimated tries to create an animated version of Text
 * internally and encounters TextImpl, which isn't wrapped with forwardRef.
 * 
 * By patching Text before reanimated tries to use it, we ensure compatibility.
 * This patch must happen before any animated components are created.
 */
try {
  // Use a more compatible approach: patch the module exports
  // This ensures that when reanimated imports Text, it gets the wrapped version
  const ReactNativeModule = require('react-native');
  
  if (ReactNativeModule && ReactNativeModule.Text && typeof ReactNativeModule.Text === 'function') {
    const OriginalText = ReactNativeModule.Text;
    
    // Check if Text needs patching
    // React Native's Text component should already support refs, but we wrap it
    // to ensure compatibility with reanimated's createAnimatedComponent
    const needsPatching = true; // Always patch to ensure compatibility
    
    if (needsPatching) {
      // Wrap Text with forwardRef to make it compatible with reanimated
      const WrappedText = React.forwardRef<React.ElementRef<typeof OriginalText>, TextProps>(
        (props, ref) => {
          return <OriginalText {...props} ref={ref} />;
        }
      );
      
      // Preserve static properties from the original Text component
      const staticProps = Object.getOwnPropertyNames(OriginalText);
      staticProps.forEach((prop) => {
        if (prop !== 'displayName' && prop !== 'prototype' && prop !== '$$typeof') {
          try {
            const descriptor = Object.getOwnPropertyDescriptor(OriginalText, prop);
            if (descriptor) {
              Object.defineProperty(WrappedText, prop, descriptor);
            } else {
              (WrappedText as any)[prop] = (OriginalText as any)[prop];
            }
          } catch {
            // Ignore errors when copying properties
          }
        }
      });
      
      WrappedText.displayName = 'Text';
      
      // Replace Text in the react-native module
      ReactNativeModule.Text = WrappedText;
    }
  }

  // Patch TextInput component for reanimated compatibility
  if (ReactNativeModule && ReactNativeModule.TextInput && typeof ReactNativeModule.TextInput === 'function') {
    const OriginalTextInput = ReactNativeModule.TextInput;
    
    // Wrap TextInput with forwardRef to make it compatible with reanimated
    const WrappedTextInput = React.forwardRef<React.ElementRef<typeof OriginalTextInput>, TextInputProps>(
      (props, ref) => {
        return <OriginalTextInput {...props} ref={ref} />;
      }
    );
    
    // Preserve static properties from the original TextInput component
    const textInputStaticProps = Object.getOwnPropertyNames(OriginalTextInput);
    textInputStaticProps.forEach((prop) => {
      if (prop !== 'displayName' && prop !== 'prototype' && prop !== '$$typeof') {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(OriginalTextInput, prop);
          if (descriptor) {
            Object.defineProperty(WrappedTextInput, prop, descriptor);
          } else {
            (WrappedTextInput as any)[prop] = (OriginalTextInput as any)[prop];
          }
        } catch {
          // Ignore errors when copying properties
        }
      }
    });
    
    WrappedTextInput.displayName = 'TextInput';
    
    // Replace TextInput in the react-native module
    ReactNativeModule.TextInput = WrappedTextInput;
  }
} catch (error) {
  // Silently handle any errors during patching
  // If patching fails, the app should still work with the original Text/TextInput
  // Error is intentionally not logged to avoid noise in production
}

/**
 * Export the wrapped Text component for use in this module
 */
export const Text = TextWithForwardRef;

/**
 * Export ReanimatedText as an alias for convenience
 * Components can use this if they specifically need the wrapped version
 */
export const ReanimatedText = TextWithForwardRef;

/**
 * Initialize reanimated compatibility
 * This function ensures the module is loaded and Text is patched
 * before reanimated tries to create any animated components.
 */
export function initializeReanimatedCompatibility() {
  // The patching happens at module load time, so this function
  // mainly serves as a way to ensure the module is imported early
  // Additional setup can be added here if needed
}

// Auto-initialize when module is loaded
initializeReanimatedCompatibility();

