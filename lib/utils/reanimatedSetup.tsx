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
 */
function isForwardRefComponent(component: any): boolean {
  if (!component) return false;
  
  // Check for forwardRef markers
  if (component.$$typeof === React.forwardRef.$$typeof) return true;
  if (component.render?.$$typeof === React.forwardRef.$$typeof) return true;
  if (component.__isForwardRef === true) return true;
  
  // Check if it's a class component (which doesn't need wrapping)
  if (component.prototype && component.prototype.isReactComponent) return true;
  
  return false;
}

/**
 * Wrap a component with forwardRef if it's not already wrapped
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
  
  return WrappedComponent as T;
}

/**
 * Patch React Native components BEFORE reanimated is imported
 */
try {
  const ReactNativeModule = require('react-native');
  
  // CRITICAL: Patch TextImpl FIRST if it exists
  // TextImpl is what reanimated actually uses internally
  if ((ReactNativeModule as any).TextImpl && typeof (ReactNativeModule as any).TextImpl === 'function') {
    if (!isForwardRefComponent((ReactNativeModule as any).TextImpl)) {
      (ReactNativeModule as any).TextImpl = wrapWithForwardRef(
        (ReactNativeModule as any).TextImpl,
        'TextImpl'
      );
    }
  }
  
  // Patch Text component
  if (ReactNativeModule && ReactNativeModule.Text && typeof ReactNativeModule.Text === 'function') {
    if (!isForwardRefComponent(ReactNativeModule.Text)) {
      ReactNativeModule.Text = wrapWithForwardRef(ReactNativeModule.Text, 'Text');
    }
  }

  // Patch TextInput component
  if (ReactNativeModule && ReactNativeModule.TextInput && typeof ReactNativeModule.TextInput === 'function') {
    if (!isForwardRefComponent(ReactNativeModule.TextInput)) {
      ReactNativeModule.TextInput = wrapWithForwardRef(ReactNativeModule.TextInput, 'TextInput');
    }
  }
} catch (error) {
  // Silently handle errors
  console.warn('Error patching React Native components:', error);
}

/**
 * Patch react-native-reanimated's createAnimatedComponent PROACTIVELY
 * This intercepts ALL calls to createAnimatedComponent and wraps components automatically
 */
let reanimatedPatched = false;

function patchReanimatedCreateAnimatedComponent() {
  if (reanimatedPatched) return;
  
  try {
    const reanimatedModule = require('react-native-reanimated');
    
    // Try different possible export paths
    const reanimated = reanimatedModule.default || reanimatedModule;
    
    if (reanimated && reanimated.createAnimatedComponent) {
      const originalCreateAnimatedComponent = reanimated.createAnimatedComponent.bind(reanimated);
      
      // Wrap createAnimatedComponent to automatically wrap components
      reanimated.createAnimatedComponent = function(component: any) {
        if (!component) {
          return originalCreateAnimatedComponent(component);
        }
        
        // If component is already wrapped or is a class component, use it directly
        if (isForwardRefComponent(component)) {
          try {
            return originalCreateAnimatedComponent(component);
          } catch (error: any) {
            // If it still fails, try wrapping it
            if (error?.message?.includes('TextImpl') || error?.message?.includes('Text') || error?.message?.includes('forwardRef')) {
              const wrapped = wrapWithForwardRef(component);
              return originalCreateAnimatedComponent(wrapped);
            }
            throw error;
          }
        }
        
        // Component name check - if it's TextImpl or similar, wrap it
        const componentName = component.displayName || component.name || '';
        if (componentName.includes('Text') || componentName.includes('TextImpl') || componentName.includes('TextInput')) {
          const wrapped = wrapWithForwardRef(component, componentName);
          return originalCreateAnimatedComponent(wrapped);
        }
        
        // For other function components, try wrapping if they fail
        try {
          return originalCreateAnimatedComponent(component);
        } catch (error: any) {
          // If error mentions forwardRef or TextImpl, wrap and retry
          if (error?.message?.includes('forwardRef') || 
              error?.message?.includes('TextImpl') || 
              error?.message?.includes('function component')) {
            const wrapped = wrapWithForwardRef(component);
            return originalCreateAnimatedComponent(wrapped);
          }
          throw error;
        }
      };
      
      // Also patch the default export if it exists
      if (reanimatedModule.default && reanimatedModule.default !== reanimated) {
        reanimatedModule.default.createAnimatedComponent = reanimated.createAnimatedComponent;
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

// Also try patching after a short delay in case reanimated loads asynchronously
if (typeof setTimeout !== 'undefined') {
  setTimeout(() => {
    patchReanimatedCreateAnimatedComponent();
  }, 100);
  
  setTimeout(() => {
    patchReanimatedCreateAnimatedComponent();
  }, 500);
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
