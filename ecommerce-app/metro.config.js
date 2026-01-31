const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for .wasm files
config.resolver.assetExts.push('wasm');

// Make sure mjs is recognized
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts = ['mjs', ...config.resolver.sourceExts];
}

// Configure to skip web for now
config.transformer = {
  ...config.transformer,
  minifierPath: require.resolve('metro-minify-terser'),
};

module.exports = config;
