const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration to handle platform-specific modules
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Configure transformer to handle large bundles
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

// Increase memory limits
config.transformer.maxWorkers = 2;

module.exports = config;