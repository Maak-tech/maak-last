const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Only essential configurations for production stability
config.transformer.unstable_allowRequireContext = true;

module.exports = config;
