const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add support for importing from the root with @/ prefix
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

// Configure path aliases
config.resolver.alias = {
  ...config.resolver.alias,
  '@': path.resolve(__dirname),
};

module.exports = config;
