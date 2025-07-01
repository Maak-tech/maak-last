const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Basic configuration without experimental features
config.transformer.unstable_allowRequireContext = true;

// SDK 51 compatible resolver settings
config.resolver.unstable_enableSymlinks = false;
config.resolver.unstable_enablePackageExports = false;

// Ensure compatibility with Metro 0.80.x
config.resetCache = true;

module.exports = config;
