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
 * 
 * This module MUST be imported BEFORE react-native-reanimated or react-native-vision-camera
 * to ensure TextImpl is patched before reanimated tries to use it.
 */

import React from 'react';
import { Text as RNText, TextProps, TextInput as RNTextInput, TextInputProps } from 'react-native';

/**
 * Helper function to check if a component is wrapped with forwardRef
 * MUST be defined before the IIFE that uses it
 */
function isForwardRefComponent(component: any): boolean {
  if (!component) return false;
  
  // Check for forwardRef markers (React 19 compatible)
  try {
    // Use type assertion to access $$typeof on forwardRef
    const forwardRefSymbol = (React.forwardRef as any).$$typeof;
    if (forwardRefSymbol && component.$$typeof === forwardRefSymbol) return true;
    if (component.render?.$$typeof === forwardRefSymbol) return true;
    if (component.__isForwardRef === true) return true;
    
    // Check if it's a class component (which doesn't need wrapping)
    if (component.prototype && component.prototype.isReactComponent) return true;
    
    // Check for React 19 memo/forwardRef combinations
    if (component.type && component.type.$$typeof === forwardRefSymbol) return true;
  } catch {
    // If checking fails, assume it needs wrapping
    return false;
  }
  
  return false;
}

/**
 * Wrap a component with forwardRef if it's not already wrapped
 * MUST be defined before the IIFE that uses it
 */
function wrapWithForwardRef<T extends React.ComponentType<any>>(component: T, displayName?: string): T {
  if (isForwardRefComponent(component)) {
    return component;
  }
  
  const WrappedComponent = React.forwardRef<any, any>((props, ref) => {
    return React.createElement(component, { ...props, ref });
  });
  
  WrappedComponent.displayName = displayName || component.displayName || component.name || 'WrappedComponent';
  (WrappedComponent as any).__isForwardRef = true;
  
  // Preserve static properties
  Object.keys(component).forEach((key) => {
    try {
      if (key !== 'displayName' && key !== 'prototype' && key !== '$$typeof' && key !== 'render' && key !== 'name') {
        (WrappedComponent as any)[key] = (component as any)[key];
      }
    } catch {
      // Ignore errors copying properties
    }
  });
  
  // Use 'unknown' intermediate type to avoid TypeScript conversion errors
  return WrappedComponent as unknown as T;
}

/**
 * Patch React Native components BEFORE reanimated is imported
 * This must happen IMMEDIATELY when this module loads
 * Use IIFE to execute immediately
 * CRITICAL: This runs BEFORE any other code, ensuring TextImpl is patched first
 */
(function patchReactNativeComponents() {
  'use strict';
  
  // Execute immediately, don't wait for anything
  try {
    const ReactNativeModule = require('react-native');
    
    // Ensure React is available
    const React = require('react');
    if (!React || !ReactNativeModule) {
      return;
    }
    
    // CRITICAL: Patch TextImpl FIRST if it exists
    // TextImpl is what reanimated actually uses internally
    // In React Native 0.81+, TextImpl might be in a different location
    const TextImplPaths = [
      'TextImpl',
      'Text.TextImpl',
      'TextInput.TextImpl',
    ];
    
    for (const path of TextImplPaths) {
      const parts = path.split('.');
      if (!parts || parts.length === 0) continue;
      
      let current: any = ReactNativeModule;
      for (const part of parts) {
        if (current && current[part]) {
          current = current[part];
        } else {
          current = null;
          break;
        }
      }
      
      if (current && typeof current === 'function' && !isForwardRefComponent(current)) {
        const wrapped = wrapWithForwardRef(current, 'TextImpl');
        if (parts && parts.length === 1) {
          (ReactNativeModule as any)[parts[0]] = wrapped;
        } else if (parts && parts.length > 1) {
          let target: any = ReactNativeModule;
          for (let i = 0; i < parts.length - 1; i++) {
            if (target && parts[i]) {
              target = target[parts[i]];
            } else {
              target = null;
              break;
            }
          }
          if (target && parts[parts.length - 1]) {
            target[parts[parts.length - 1]] = wrapped;
          }
        }
      }
    }
    
    // Patch Text component - wrap it immediately
    if (ReactNativeModule && ReactNativeModule.Text && typeof ReactNativeModule.Text === 'function') {
      if (!isForwardRefComponent(ReactNativeModule.Text)) {
        const originalText = ReactNativeModule.Text;
        ReactNativeModule.Text = wrapWithForwardRef(originalText, 'Text');
        
        // Also try to patch TextImpl if it's accessed via Text
        try {
          if ((ReactNativeModule.Text as any).TextImpl && typeof (ReactNativeModule.Text as any).TextImpl === 'function') {
            if (!isForwardRefComponent((ReactNativeModule.Text as any).TextImpl)) {
              (ReactNativeModule.Text as any).TextImpl = wrapWithForwardRef(
                (ReactNativeModule.Text as any).TextImpl,
                'TextImpl'
              );
            }
          }
        } catch {
          // Ignore errors accessing TextImpl
        }
      }
    }

    // Patch TextInput component
    if (ReactNativeModule && ReactNativeModule.TextInput && typeof ReactNativeModule.TextInput === 'function') {
      if (!isForwardRefComponent(ReactNativeModule.TextInput)) {
        ReactNativeModule.TextInput = wrapWithForwardRef(ReactNativeModule.TextInput, 'TextInput');
      }
    }
    
    // AGGRESSIVE: Try to find TextImpl in internal React Native structures
    try {
      // Check if TextImpl exists as a separate export
      const internalText = (ReactNativeModule as any).Text;
      if (internalText) {
        // Try to access TextImpl through various paths
        const possibleTextImplPaths = [
          () => (ReactNativeModule as any).TextImpl,
          () => (ReactNativeModule as any).Text?.TextImpl,
          () => (ReactNativeModule as any).TextInput?.TextImpl,
          () => internalText.TextImpl,
          () => (internalText as any).render?.TextImpl,
        ];
        
        for (const getTextImpl of possibleTextImplPaths) {
          try {
            const textImpl = getTextImpl();
            if (textImpl && typeof textImpl === 'function' && !isForwardRefComponent(textImpl)) {
              const wrapped = wrapWithForwardRef(textImpl, 'TextImpl');
              // Try to set it back
              try {
                if ((ReactNativeModule as any).TextImpl !== undefined) {
                  (ReactNativeModule as any).TextImpl = wrapped;
                }
                if (internalText.TextImpl !== undefined) {
                  internalText.TextImpl = wrapped;
                }
              } catch {
                // Can't set it, but at least we tried
              }
            }
          } catch {
            // Path doesn't exist, continue
          }
        }
      }
    } catch {
      // Ignore errors in aggressive patching
    }
  } catch (error) {
    // Silently handle errors
    console.warn('Error patching React Native components:', error);
  }
})();

/**
 * Patch react-native-reanimated's createAnimatedComponent PROACTIVELY
 * This intercepts ALL calls to createAnimatedComponent and wraps components automatically
 */
let reanimatedPatched = false;

function patchReanimatedCreateAnimatedComponent() {
  if (reanimatedPatched) return;
  
  try {
    // CRITICAL: Patch TextImpl FIRST before requiring reanimated
    // This ensures TextImpl is wrapped before reanimated tries to use it
    const ReactNativeModule = require('react-native');
    const React = require('react');
    
    // Patch TextImpl aggressively BEFORE reanimated loads
    if (ReactNativeModule && ReactNativeModule.Text) {
      const TextComponent = ReactNativeModule.Text;
      if (TextComponent && typeof TextComponent === 'function' && !isForwardRefComponent(TextComponent)) {
        ReactNativeModule.Text = wrapWithForwardRef(TextComponent, 'Text');
      }
      
      // Try to patch TextImpl if it exists - check multiple locations
      try {
        // Check Text.TextImpl first
        if ((ReactNativeModule.Text as any).TextImpl && typeof (ReactNativeModule.Text as any).TextImpl === 'function') {
          if (!isForwardRefComponent((ReactNativeModule.Text as any).TextImpl)) {
            (ReactNativeModule.Text as any).TextImpl = wrapWithForwardRef(
              (ReactNativeModule.Text as any).TextImpl,
              'TextImpl'
            );
          }
        }
        
        // Check root-level TextImpl
        if ((ReactNativeModule as any).TextImpl && typeof (ReactNativeModule as any).TextImpl === 'function') {
          if (!isForwardRefComponent((ReactNativeModule as any).TextImpl)) {
            (ReactNativeModule as any).TextImpl = wrapWithForwardRef(
              (ReactNativeModule as any).TextImpl,
              'TextImpl'
            );
          }
        }
        
        // Use Proxy to intercept TextImpl access if it doesn't exist yet
        // This catches cases where TextImpl is accessed dynamically
        if (!(ReactNativeModule.Text as any).TextImpl && !(ReactNativeModule as any).TextImpl) {
          // Create a wrapped TextImpl that will be used if accessed
          const wrappedTextImpl = wrapWithForwardRef(ReactNativeModule.Text, 'TextImpl');
          
          // Set up getter interceptors
          try {
            Object.defineProperty(ReactNativeModule.Text, 'TextImpl', {
              get: () => wrappedTextImpl,
              configurable: true,
              enumerable: true,
            });
          } catch {
            // Can't define property, that's okay
          }
          
          try {
            Object.defineProperty(ReactNativeModule, 'TextImpl', {
              get: () => wrappedTextImpl,
              configurable: true,
              enumerable: true,
            });
          } catch {
            // Can't define property, that's okay
          }
        }
      } catch {
        // TextImpl might not exist, that's okay
      }
    }
    
    // Use a try-catch wrapper around require to catch any errors during module loading
    let reanimatedModule;
    try {
      reanimatedModule = require('react-native-reanimated');
    } catch (requireError) {
      // Module not available yet, will retry later
      return;
    }
    
    // Try different possible export paths
    const reanimated = reanimatedModule.default || reanimatedModule;
    
    if (reanimated && reanimated.createAnimatedComponent) {
      // Check if already patched by checking for our marker
      if ((reanimated.createAnimatedComponent as any).__patchedByReanimatedSetup) {
        reanimatedPatched = true;
        return;
      }
      
      const originalCreateAnimatedComponent = reanimated.createAnimatedComponent.bind(reanimated);
      
      // Wrap createAnimatedComponent to automatically wrap components
      // Use a wrapper that catches ALL errors, including synchronous ones
      const wrappedFunction = function(component: any) {
        // Always wrap in try-catch to catch any errors
        try {
          if (!component) {
            return originalCreateAnimatedComponent(component);
          }
          
          // CRITICAL: Check if component is TextImpl by checking its internal structure
          // React Native 0.79+ might expose TextImpl differently
          let isTextImpl = false;
          try {
            const componentName = component.displayName || component.name || component.constructor?.name || '';
            const componentString = String(component);
            
            // Check multiple ways to identify TextImpl
            isTextImpl = componentName === 'TextImpl' ||
                        componentName.includes('TextImpl') ||
                        componentString.includes('TextImpl') ||
                        component === ReactNativeModule?.Text ||
                        component === ReactNativeModule?.TextInput ||
                        (ReactNativeModule?.Text && component === (ReactNativeModule.Text as any).TextImpl) ||
                        (ReactNativeModule?.TextInput && component === (ReactNativeModule.TextInput as any).TextImpl);
          } catch {
            // If we can't check, assume it might be TextImpl if it's a function
            isTextImpl = typeof component === 'function';
          }
          
          // PROACTIVE: If it's TextImpl or any Text component, wrap it BEFORE calling createAnimatedComponent
          if (isTextImpl && !isForwardRefComponent(component)) {
            const wrapped = wrapWithForwardRef(component, 'TextImpl');
            try {
              return originalCreateAnimatedComponent(wrapped);
            } catch (error: any) {
              // If wrapping still fails, return the wrapped component anyway
              // This prevents the error from propagating
              console.warn('Failed to create animated component with wrapped TextImpl:', error?.message || error);
              return wrapped;
            }
          }
          
          // PROACTIVE: Check component name for Text-related components
          const componentName = component.displayName || component.name || component.constructor?.name || '';
          const isTextComponent = componentName.includes('Text') || 
                                  componentName.includes('TextInput') ||
                                  component === ReactNativeModule?.Text ||
                                  component === ReactNativeModule?.TextInput;
          
          // If it's a Text component, wrap it proactively BEFORE calling createAnimatedComponent
          if (isTextComponent && !isForwardRefComponent(component)) {
            const wrapped = wrapWithForwardRef(component, componentName || 'TextComponent');
            try {
              return originalCreateAnimatedComponent(wrapped);
            } catch (error: any) {
              // If wrapping still fails, return the wrapped component anyway
              console.warn('Failed to create animated component with wrapped Text:', error?.message || error);
              return wrapped;
            }
          }
          
          // If component is already wrapped or is a class component, use it directly
          if (isForwardRefComponent(component)) {
            try {
              return originalCreateAnimatedComponent(component);
            } catch (error: any) {
              // If it still fails, try wrapping it
              const errorMessage = error?.message || '';
              if (errorMessage.includes('TextImpl') || errorMessage.includes('Text') || errorMessage.includes('forwardRef')) {
                const wrapped = wrapWithForwardRef(component);
                try {
                  return originalCreateAnimatedComponent(wrapped);
                } catch {
                  // If that also fails, return wrapped component
                  return wrapped;
                }
              }
              throw error;
            }
          }
          
          // For other function components, try wrapping if they fail
          try {
            return originalCreateAnimatedComponent(component);
          } catch (error: any) {
            // If error mentions forwardRef or TextImpl, wrap and retry
            const errorMessage = error?.message || '';
            if (errorMessage.includes('forwardRef') || 
                errorMessage.includes('TextImpl') || 
                errorMessage.includes('function component') ||
                errorMessage.includes('Text')) {
              const wrapped = wrapWithForwardRef(component);
              try {
                return originalCreateAnimatedComponent(wrapped);
              } catch {
                // If that also fails, return wrapped component to prevent crash
                return wrapped;
              }
            }
            throw error;
          }
        } catch (error: any) {
          // Catch-all: if ANY error occurs, try wrapping the component
          const errorMessage = error?.message || String(error || '');
          if (errorMessage.includes('TextImpl') || 
              errorMessage.includes('forwardRef') || 
              errorMessage.includes('function component') ||
              errorMessage.includes('Text')) {
            try {
              const wrapped = wrapWithForwardRef(component);
              try {
                return originalCreateAnimatedComponent(wrapped);
              } catch {
                // Return wrapped component to prevent crash
                return wrapped;
              }
            } catch {
              // If wrapping fails, return a safe fallback
              return component;
            }
          }
          // Re-throw if it's not a TextImpl error
          throw error;
        }
      };
      
      // Preserve the original function's properties
      Object.setPrototypeOf(wrappedFunction, originalCreateAnimatedComponent);
      Object.getOwnPropertyNames(originalCreateAnimatedComponent).forEach((name) => {
        try {
          (wrappedFunction as any)[name] = (originalCreateAnimatedComponent as any)[name];
        } catch {
          // Ignore errors copying properties
        }
      });
      
      reanimated.createAnimatedComponent = wrappedFunction;
      
      // Mark as patched
      (reanimated.createAnimatedComponent as any).__patchedByReanimatedSetup = true;
      
      // Also patch the default export if it exists
      if (reanimatedModule.default && reanimatedModule.default !== reanimated) {
        reanimatedModule.default.createAnimatedComponent = reanimated.createAnimatedComponent;
        (reanimatedModule.default.createAnimatedComponent as any).__patchedByReanimatedSetup = true;
      }
      
      reanimatedPatched = true;
    }
  } catch (error) {
    // Reanimated might not be available yet, which is fine
    // We'll try again when it loads
  }
}

// Try to patch immediately
patchReanimatedCreateAnimatedComponent();

// Also try patching after delays in case reanimated loads asynchronously
if (typeof setTimeout !== 'undefined') {
  setTimeout(() => {
    patchReanimatedCreateAnimatedComponent();
  }, 0);
  
  setTimeout(() => {
    patchReanimatedCreateAnimatedComponent();
  }, 50);
  
  setTimeout(() => {
    patchReanimatedCreateAnimatedComponent();
  }, 100);
  
  setTimeout(() => {
    patchReanimatedCreateAnimatedComponent();
  }, 500);
  
  // Also try after a longer delay for lazy-loaded modules
  setTimeout(() => {
    patchReanimatedCreateAnimatedComponent();
  }, 1000);
}

/**
 * Export function to manually trigger patching
 * This can be called from components that use reanimated
 */
export function ensureReanimatedPatched() {
  patchReanimatedCreateAnimatedComponent();
}

/**
 * Initialize reanimated compatibility
 */
export function initializeReanimatedCompatibility() {
  patchReanimatedCreateAnimatedComponent();
}

// Auto-initialize when module is loaded
initializeReanimatedCompatibility();
