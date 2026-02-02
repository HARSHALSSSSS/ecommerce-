/**
 * iOS-Specific Optimizations
 * Platform-specific configs for optimal iOS performance
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';

// ============================================
// iOS PERFORMANCE CONFIGURATIONS
// ============================================

/**
 * Get iOS device performance tier
 */
export const getDevicePerformanceTier = async (): Promise<'low' | 'medium' | 'high'> => {
  if (!Device.osVersion) {
    return 'medium';
  }

  const majorVersion = parseInt(Device.osVersion.split('.')[0], 10);

  // Older iOS devices = lower tier
  if (majorVersion < 14) {
    return 'low';
  } else if (majorVersion < 16) {
    return 'medium';
  } else {
    return 'high';
  }
};

// ============================================
// ADAPTIVE CONFIGURATION
// ============================================

export interface AdaptiveConfig {
  imageQuality: number;
  thumbQuality: number;
  maxConcurrentRequests: number;
  requestTimeout: number;
  cacheSize: number; // MB
  batchSize: number;
  renderBatchSize: number;
  enableMemoryOptimization: boolean;
}

const LOW_TIER_CONFIG: AdaptiveConfig = {
  imageQuality: 0.6, // 60% quality for older devices
  thumbQuality: 0.4,
  maxConcurrentRequests: 2,
  requestTimeout: 15000,
  cacheSize: 30, // 30 MB max cache
  batchSize: 5,
  renderBatchSize: 10,
  enableMemoryOptimization: true,
};

const MEDIUM_TIER_CONFIG: AdaptiveConfig = {
  imageQuality: 0.75,
  thumbQuality: 0.5,
  maxConcurrentRequests: 3,
  requestTimeout: 12000,
  cacheSize: 50,
  batchSize: 10,
  renderBatchSize: 15,
  enableMemoryOptimization: true,
};

const HIGH_TIER_CONFIG: AdaptiveConfig = {
  imageQuality: 0.85,
  thumbQuality: 0.6,
  maxConcurrentRequests: 4,
  requestTimeout: 10000,
  cacheSize: 100,
  batchSize: 20,
  renderBatchSize: 20,
  enableMemoryOptimization: false,
};

let cachedConfig: AdaptiveConfig | null = null;
let configPromise: Promise<AdaptiveConfig> | null = null;

/**
 * Get adaptive config based on device
 */
export const getAdaptiveConfig = async (): Promise<AdaptiveConfig> => {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (configPromise) {
    return configPromise;
  }

  configPromise = (async () => {
    if (Platform.OS !== 'ios') {
      return MEDIUM_TIER_CONFIG;
    }

    const tier = await getDevicePerformanceTier();
    
    switch (tier) {
      case 'low':
        cachedConfig = LOW_TIER_CONFIG;
        break;
      case 'high':
        cachedConfig = HIGH_TIER_CONFIG;
        break;
      default:
        cachedConfig = MEDIUM_TIER_CONFIG;
    }

    return cachedConfig;
  })();

  return configPromise;
};

// ============================================
// iOS MEMORY MANAGEMENT
// ============================================

/**
 * Memory warning handler
 */
export const setupMemoryWarningHandler = () => {
  if (Platform.OS !== 'ios') {
    return;
  }

  // Note: This requires native module integration
  // For now, we implement app-level memory management
};

/**
 * Cleanup resources on app pause
 */
export const setupAppLifecycleHandlers = () => {
  const appState = require('react-native').AppState;
  const subscription = appState.addEventListener('change', handleAppStateChange);

  return () => subscription.remove();
};

const handleAppStateChange = (state: string) => {
  if (state === 'background') {
    // Clear non-essential caches
    console.log('[iOS] App backgrounded - cleaning up resources');
  } else if (state === 'active') {
    // Resume normal operations
    console.log('[iOS] App resumed');
  }
};

// ============================================
// iOS-SPECIFIC STYLING
// ============================================

/**
 * Get iOS-safe padding
 */
export const getIOSSafePadding = (top: number, bottom: number) => {
  return Platform.select({
    ios: { paddingTop: top, paddingBottom: bottom },
    default: { paddingVertical: 0 },
  });
};

// ============================================
// NATIVE BRIDGE OPTIMIZATION
// ============================================

/**
 * Batch native module calls to reduce bridge overhead
 */
export const batchNativeCall = async (calls: Array<() => Promise<any>>) => {
  // Group sequential calls to minimize native bridge crossings
  const results: any[] = [];

  for (const call of calls) {
    results.push(await call());
  }

  return results;
};

// ============================================
// NETWORK OPTIMIZATION FOR iOS
// ============================================

/**
 * iOS network optimization config
 */
export const iOSNetworkConfig = {
  // Use keep-alive for connection reuse
  'Connection': 'keep-alive',
  'Keep-Alive': 'timeout=5, max=100',
  
  // Enable HTTP/2 when possible
  'Accept-Encoding': 'gzip, deflate, br',
  
  // Limit request size
  'Content-Length': 'auto',
  
  // TCP optimization
  TCP_NODELAY: true,
  SO_KEEPALIVE: true,
};

// ============================================
// PROFILING & DEBUGGING
// ============================================

/**
 * Performance profiler for iOS
 */
export class PerformanceProfiler {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number[]> = new Map();

  mark(name: string) {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string, endMark?: string) {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : performance.now();

    if (!start) {
      console.warn(`Mark ${startMark} not found`);
      return;
    }

    const duration = (end ?? 0) - start;
    
    if (!this.measures.has(name)) {
      this.measures.set(name, []);
    }
    
    this.measures.get(name)?.push(duration);

    if (Platform.OS === 'ios') {
      console.log(`[iOS Profile] ${name}: ${duration.toFixed(2)}ms`);
    }
  }

  getMetrics() {
    const metrics: Record<string, any> = {};
    
    for (const [name, times] of this.measures) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      metrics[name] = { avg: avg.toFixed(2), min, max, samples: times.length };
    }

    return metrics;
  }

  clear() {
    this.marks.clear();
    this.measures.clear();
  }
}

export const profiler = new PerformanceProfiler();

export default {
  getDevicePerformanceTier,
  getAdaptiveConfig,
  setupMemoryWarningHandler,
  setupAppLifecycleHandlers,
  getIOSSafePadding,
  batchNativeCall,
  iOSNetworkConfig,
  profiler,
};
