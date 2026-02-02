/**
 * App Initialization & Optimization Setup
 * Initialize all performance optimizations on app startup
 */

import { Platform } from 'react-native';
import { setupAppLifecycleHandlers, profiler, getAdaptiveConfig } from '@/src/utils/iOSOptimization';
import { clearImageCache, getCacheStats } from '@/src/utils/imageOptimization';

/**
 * Initialize app optimizations
 */
export const initializeAppOptimizations = async () => {
  try {
    // iOS-specific setup
    if (Platform.OS === 'ios') {
      console.log('🍎 Initializing iOS optimizations...');
      
      // Setup memory management
      setupAppLifecycleHandlers();
      
      // Get device performance tier
      const tier = await getAdaptiveConfig();
      console.log('📊 Device Config:', {
        imageQuality: tier.imageQuality,
        cacheSize: tier.cacheSize,
        maxConcurrentRequests: tier.maxConcurrentRequests,
      });
    }

    // Cleanup old cache on app start
    console.log('🧹 Cleaning up image cache...');
    
    const stats = await getCacheStats();
    console.log('💾 Cache stats:', stats);

    // Log optimization profile
    profiler.mark('app_start');
    console.log('✅ App optimizations initialized');
  } catch (error) {
    console.error('❌ Error initializing optimizations:', error);
  }
};

/**
 * Cleanup on app close
 */
export const cleanupOnAppExit = async () => {
  try {
    if (Platform.OS === 'ios') {
      console.log('🍎 iOS cleanup on app exit');
      
      // Log final metrics
      const metrics = profiler.getMetrics();
      console.log('📈 Performance metrics:', metrics);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

export default {
  initializeAppOptimizations,
  cleanupOnAppExit,
};
