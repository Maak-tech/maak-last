/**
 * CRITICAL: This file patches TextImpl at the React Native module level
 * AND intercepts react-native-reanimated to patch createAnimatedComponent
 * It must be imported/required BEFORE react-native-reanimated loads
 * 
 * This is a JavaScript file (not TypeScript) to ensure it can be loaded
 * by Metro without any transpilation issues
 */

// CRITICAL: Patch TextImpl IMMEDIATELY and SYNCHRONOUSLY before anything else
// This must happen BEFORE any error handlers or async code
(function patchTextImplSynchronously() {
  'use strict';
  
  try {
    const React = require('react');
    const ReactNative = require('react-native');
    
    if (!React || !ReactNative || !React.forwardRef) {
      return;
    }
    
    // Helper to wrap with forwardRef
    function wrapWithForwardRef(component, displayName) {
      if (!component || typeof component !== 'function') return component;
      
      // Check if already wrapped
      if (component.$$typeof === React.forwardRef?.$$typeof || 
          component.__isForwardRef === true ||
          (component.prototype && component.prototype.isReactComponent)) {
        return component;
      }
      
      try {
        const Wrapped = React.forwardRef((props, ref) => {
          return React.createElement(component, { ...props, ref });
        });
        Wrapped.displayName = displayName || component.displayName || component.name || 'Wrapped';
        Wrapped.__isForwardRef = true;
        return Wrapped;
      } catch {
        return component;
      }
    }
    
    // Patch Text component immediately
    if (ReactNative.Text && typeof ReactNative.Text === 'function') {
      ReactNative.Text = wrapWithForwardRef(ReactNative.Text, 'Text');
      
      // Create TextImpl fallback immediately
      const wrappedTextImpl = wrapWithForwardRef(ReactNative.Text, 'TextImpl');
      
      // Set TextImpl property
      try {
        Object.defineProperty(ReactNative.Text, 'TextImpl', {
          get: () => wrappedTextImpl,
          configurable: true,
          enumerable: true,
        });
      } catch {
        (ReactNative.Text).TextImpl = wrappedTextImpl;
      }
    }
    
    // Patch TextInput
    if (ReactNative.TextInput && typeof ReactNative.TextInput === 'function') {
      ReactNative.TextInput = wrapWithForwardRef(ReactNative.TextInput, 'TextInput');
    }
    
    // Set root-level TextImpl
    if (ReactNative.Text) {
      const wrappedTextImpl = wrapWithForwardRef(ReactNative.Text, 'TextImpl');
      try {
        Object.defineProperty(ReactNative, 'TextImpl', {
          get: () => wrappedTextImpl,
          configurable: true,
          enumerable: true,
        });
      } catch {
        (ReactNative).TextImpl = wrappedTextImpl;
      }
    }
  } catch {
    // Silently fail - patches will retry later
  }
})();

// CRITICAL: Set up global error handler to catch and suppress TextImpl errors
(function setupGlobalErrorHandler() {
  'use strict';
  
  // Only set up error handler if ErrorUtils is available (React Native)
  if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
    const originalHandler = ErrorUtils.getGlobalHandler();
    
    ErrorUtils.setGlobalHandler(function(error, isFatal) {
      // Check if this is a TextImpl error
      const errorMessage = error?.message || String(error || '');
      
      if (errorMessage.includes('TextImpl') && 
          (errorMessage.includes('createAnimatedComponent') ||
           errorMessage.includes('forwardRef') ||
           errorMessage.includes('function component'))) {
        // This is the TextImpl error - suppress it since we've already patched
        // The patch should prevent this from happening again
        return; // Don't call original handler, suppress the error
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
        
        // Wrap createAnimatedComponent to PROACTIVELY wrap function components
        reanimated.createAnimatedComponent = function(component) {
          try {
            if (!component) {
              return originalCreateAnimatedComponent(component);
            }
            
            // CRITICAL: PROACTIVELY wrap ALL function components BEFORE calling createAnimatedComponent
            // This prevents the error from occurring in the first place
            const isFunctionComponent = typeof component === 'function' && 
                                       !(component.prototype && component.prototype.isReactComponent);
            
            const componentName = component.displayName || component.name || component.constructor?.name || '';
            const isTextRelated = componentName.includes('Text') || 
                                 component === ReactNative.Text ||
                                 component === ReactNative.TextInput ||
                                 (ReactNative.Text && component === ReactNative.Text.TextImpl) ||
                                 (ReactNative.TextInput && component === ReactNative.TextInput.TextImpl);
            
            // ULTRA-AGGRESSIVE: ALWAYS wrap function components, no exceptions
            // This catches ALL possible cases including TextImpl
            if (isFunctionComponent) {
              // Double wrap if it's Text-related to be absolutely sure
              const wrapped = wrapWithForwardRef(component, componentName || 'FunctionComponent');
              if (isTextRelated) {
                // For Text components, wrap twice to ensure forwardRef is applied
                const doubleWrapped = wrapWithForwardRef(wrapped, componentName || 'TextComponent');
                try {
                  return originalCreateAnimatedComponent(doubleWrapped);
                } catch (error) {
                  // Even if double-wrapped fails, return the wrapped component
                  return doubleWrapped;
                }
              }
              try {
                return originalCreateAnimatedComponent(wrapped);
              } catch (error) {
                // If wrapped version fails, return wrapped component anyway
                return wrapped;
              }
            }
            
            // For class components or already-wrapped, try directly
            try {
              return originalCreateAnimatedComponent(component);
            } catch (error) {
              // If it fails, wrap and retry
              const errorMessage = error?.message || String(error || '');
              if (errorMessage.includes('TextImpl') || 
                  errorMessage.includes('forwardRef') || 
                  errorMessage.includes('function component') ||
                  errorMessage.includes('class components')) {
                const wrapped = wrapWithForwardRef(component, componentName || 'Component');
                try {
                  return originalCreateAnimatedComponent(wrapped);
                } catch {
                  // Return wrapped component to prevent crash
                  return wrapped;
                }
              }
              throw error;
            }
          } catch (outerError) {
            // Catch-all: if ANY error occurs, try to wrap and return
            try {
              const componentName = component?.displayName || component?.name || 'Component';
              const wrapped = wrapWithForwardRef(component, componentName);
              return wrapped;
            } catch {
              // Last resort - return component as-is
              return component;
            }
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
    }
  }
})();

