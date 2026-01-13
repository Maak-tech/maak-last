'use strict';

/**
 * Polyfill for react-native-reanimated's Text component
 * 
 * This fixes the "function component TextImpl to createAnimatedComponent" error
 * in React Native 0.81+ with React 19.
 */

const React = require('react');
const { Text } = require('react-native');

// Wrap Text with forwardRef to make it compatible with createAnimatedComponent
const ForwardedText = React.forwardRef((props, ref) => {
  return React.createElement(Text, { ...props, ref });
});

ForwardedText.displayName = 'Text';

// Import createAnimatedComponent but handle the error gracefully
let createAnimatedComponent;
try {
  createAnimatedComponent = require('react-native-reanimated/src/createAnimatedComponent').createAnimatedComponent;
} catch {
  // If we can't import it, create a passthrough
  createAnimatedComponent = (Component) => Component;
}

// Create AnimatedText safely
let AnimatedText;
try {
  AnimatedText = createAnimatedComponent(ForwardedText);
} catch {
  // Fallback to just the forwarded text
  AnimatedText = ForwardedText;
}

module.exports = {
  AnimatedText,
};
