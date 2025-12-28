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
 * Patch React Native components BEFORE reanimated is imported
 * This ensures reanimated sees the wrapped versions from the start
 */
try {
  const ReactNativeModule = require('react-native');
  
  // Patch Text component FIRST, before reanimated tries to use it
  if (ReactNativeModule && ReactNativeModule.Text && typeof ReactNativeModule.Text === 'function') {
    const OriginalText = ReactNativeModule.Text;
    
    // Check if already wrapped
    const isAlreadyWrapped = OriginalText.$$typeof === React.forwardRef.$$typeof || 
                              (OriginalText as any).render?.$$typeof === React.forwardRef.$$typeof;
    
    if (!isAlreadyWrapped) {
      const WrappedText = React.forwardRef<React.ElementRef<typeof OriginalText>, TextProps>(
        (props, ref) => {
          return <OriginalText {...props} ref={ref} />;
        }
      );
      
      // Preserve static properties
      Object.keys(OriginalText).forEach((key) => {
        try {
          if (key !== 'displayName' && key !== 'prototype' && key !== '$$typeof' && key !== 'render') {
            (WrappedText as any)[key] = (OriginalText as any)[key];
          }
        } catch {
          // Ignore errors
        }
      });
      
      WrappedText.displayName = 'Text';
      ReactNativeModule.Text = WrappedText;
    }
    
    // Patch TextImpl if it exists (this is what reanimated might be trying to use)
    if ((ReactNativeModule as any).TextImpl && typeof (ReactNativeModule as any).TextImpl === 'function') {
      const OriginalTextImpl = (ReactNativeModule as any).TextImpl;
      const isTextImplWrapped = OriginalTextImpl.$$typeof === React.forwardRef.$$typeof ||
                                 (OriginalTextImpl as any).render?.$$typeof === React.forwardRef.$$typeof;
      
      if (!isTextImplWrapped) {
        const WrappedTextImpl = React.forwardRef<any, any>(
          (props, ref) => {
            return React.createElement(OriginalTextImpl, { ...props, ref });
          }
        );
        WrappedTextImpl.displayName = 'TextImpl';
        (ReactNativeModule as any).TextImpl = WrappedTextImpl;
      }
    }
  }

  // Patch TextInput component
  if (ReactNativeModule && ReactNativeModule.TextInput && typeof ReactNativeModule.TextInput === 'function') {
    const OriginalTextInput = ReactNativeModule.TextInput;
    const isTextInputWrapped = OriginalTextInput.$$typeof === React.forwardRef.$$typeof ||
                               (OriginalTextInput as any).render?.$$typeof === React.forwardRef.$$typeof;
    
    if (!isTextInputWrapped) {
      const WrappedTextInput = React.forwardRef<React.ElementRef<typeof OriginalTextInput>, TextInputProps>(
        (props, ref) => {
          return <OriginalTextInput {...props} ref={ref} />;
        }
      );
      
      Object.keys(OriginalTextInput).forEach((key) => {
        try {
          if (key !== 'displayName' && key !== 'prototype' && key !== '$$typeof') {
            (WrappedTextInput as any)[key] = (OriginalTextInput as any)[key];
          }
        } catch {
          // Ignore errors
        }
      });
      
      WrappedTextInput.displayName = 'TextInput';
      ReactNativeModule.TextInput = WrappedTextInput;
    }
  }
} catch (error) {
  // Silently handle errors
}

/**
 * Patch react-native-reanimated's createAnimatedComponent to handle TextImpl gracefully
 * This is a fallback approach that intercepts the error if patching above didn't work
 */
try {
  // Only try to patch if reanimated is already loaded
  const reanimatedModule = require('react-native-reanimated');
  
  if (reanimatedModule && reanimatedModule.default && reanimatedModule.default.createAnimatedComponent) {
    const originalCreateAnimatedComponent = reanimatedModule.default.createAnimatedComponent;
    
    // Wrap createAnimatedComponent to handle TextImpl errors gracefully
    reanimatedModule.default.createAnimatedComponent = function(component: any) {
      try {
        return originalCreateAnimatedComponent(component);
      } catch (error: any) {
        // If error mentions TextImpl or Text, try to wrap it
        if (error?.message?.includes('TextImpl') || error?.message?.includes('Text')) {
          try {
            const WrappedComponent = React.forwardRef<any, any>((props, ref) => {
              return React.createElement(component, { ...props, ref });
            });
            WrappedComponent.displayName = component.displayName || component.name || 'Text';
            return originalCreateAnimatedComponent(WrappedComponent);
          } catch {
            // If wrapping fails, return original component (might cause issues but won't crash)
            console.warn('Failed to wrap component for reanimated, using original:', component.displayName || component.name);
            return component;
          }
        }
        throw error;
      }
    };
  }
} catch {
  // Reanimated might not be available yet, which is fine
  // The patching above should handle it before reanimated loads
}

/**
 * Patch React Native's Text component at the module level
 * This is a workaround for react-native-reanimated v3+ compatibility issues.
 */
try {
  const ReactNativeModule = require('react-native');
  
  if (ReactNativeModule && ReactNativeModule.Text && typeof ReactNativeModule.Text === 'function') {
    const OriginalText = ReactNativeModule.Text;
    
    // Always wrap Text to ensure compatibility
    const WrappedText = React.forwardRef<React.ElementRef<typeof OriginalText>, TextProps>(
      (props, ref) => {
        return <OriginalText {...props} ref={ref} />;
      }
    );
    
    // Preserve static properties
    Object.keys(OriginalText).forEach((key) => {
      try {
        if (key !== 'displayName' && key !== 'prototype' && key !== '$$typeof' && key !== 'render') {
          (WrappedText as any)[key] = (OriginalText as any)[key];
        }
      } catch {
        // Ignore errors
      }
    });
    
    WrappedText.displayName = 'Text';
    ReactNativeModule.Text = WrappedText;
    
    // Patch TextImpl if it exists
    if ((ReactNativeModule as any).TextImpl) {
      const OriginalTextImpl = (ReactNativeModule as any).TextImpl;
      const WrappedTextImpl = React.forwardRef<any, any>(
        (props, ref) => {
          return React.createElement(OriginalTextImpl, { ...props, ref });
        }
      );
      WrappedTextImpl.displayName = 'TextImpl';
      (ReactNativeModule as any).TextImpl = WrappedTextImpl;
    }
  }

  // Patch TextInput component
  if (ReactNativeModule && ReactNativeModule.TextInput && typeof ReactNativeModule.TextInput === 'function') {
    const OriginalTextInput = ReactNativeModule.TextInput;
    const WrappedTextInput = React.forwardRef<React.ElementRef<typeof OriginalTextInput>, TextInputProps>(
      (props, ref) => {
        return <OriginalTextInput {...props} ref={ref} />;
      }
    );
    
    Object.keys(OriginalTextInput).forEach((key) => {
      try {
        if (key !== 'displayName' && key !== 'prototype' && key !== '$$typeof') {
          (WrappedTextInput as any)[key] = (OriginalTextInput as any)[key];
        }
      } catch {
        // Ignore errors
      }
    });
    
    WrappedTextInput.displayName = 'TextInput';
    ReactNativeModule.TextInput = WrappedTextInput;
  }
} catch (error) {
  // Silently handle errors
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

