const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ============================================
// FIX NANOID MODULE RESOLUTION
// ============================================
const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fix nanoid/non-secure resolution issue
  if (moduleName === 'nanoid/non-secure') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/nanoid/non-secure/index.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'nanoid') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/nanoid/index.js'),
      type: 'sourceFile',
    };
  }
  // Use default resolver for everything else
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// ============================================
// BUNDLE SIZE OPTIMIZATION FOR iOS (16KB Target)
// ============================================

// 1. MINIFICATION & COMPRESSION
config.transformer = {
  ...config.transformer,
  minifierPath: require.resolve('metro-minify-terser'),
  // Enable aggressive minification
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: false,
    compress: {
      drop_console: true, // Remove console.logs in production
      drop_debugger: true,
      passes: 3, // Multiple compression passes
      unused: true,
      dead_code: true,
    },
    mangle: {
      keep_fnames: false,
      eval: true,
    },
  },
};

// 2. ASSET OPTIMIZATION
config.resolver.assetExts = [
  ...config.resolver.assetExts.filter(ext => ext !== 'svg'),
  'wasm',
  'webp', // Support webp format for better compression
  'svg', // Keep svg for vector assets
];

// 3. SOURCE EXTENSIONS - Order matters for tree-shaking
config.resolver.sourceExts = [
  'mjs', // ES modules first (tree-shakeable)
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'native',
  'web',
];

// 4. ADD RESOLUTION FIELDS FOR TREE-SHAKING
config.resolver.resolverMainFields = ['browser', 'main', 'module'];

// 5. ENABLE WORKER THREADS FOR FASTER BUILDS
config.maxWorkers = require('os').cpus().length;

// 6. CUSTOM BLOCK LIST - EXCLUDE UNNECESSARY MODULES
config.resolver.blacklistRE = /node_modules\/(.*)\/(test|__tests__|spec|stories|demo)\//;

// 7. OPTIMIZE REACT NATIVE
const extraNodeModules = {
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};

config.resolver.extraNodeModules = extraNodeModules;

// 8. CACHE OPTIMIZATION
config.cacheVersion = '1.0.0';
config.resetCache = false; // Cache should persist unless explicitly reset

// 9. ENABLE PROJECT ROOT FOR BETTER RESOLUTION
config.projectRoot = __dirname;

// 10. PLATFORM SPECIFIC OPTIMIZATION FOR iOS
if (process.env.PLATFORM === 'ios') {
  config.resolver.platforms = ['ios', 'native'];
}

module.exports = config;
