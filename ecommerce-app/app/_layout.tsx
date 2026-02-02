import React, { useEffect, useState, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDB, getAllProductsForImagePreload } from '@/src/database/db';
import { preloadAllProductImages } from '@/src/utils/imageCache';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { FeatureProvider } from '@/src/context/FeatureContext';
import { initializeAppOptimizations, cleanupOnAppExit } from '@/src/utils/appInitialization';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Prepare splash screen
try {
  SplashScreen.preventAutoHideAsync().catch(() => {});
} catch (e) {
  // Expo splash screen might not be available in some cases
  console.warn('Could not prevent splash screen auto-hide');
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const initStartedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const initializeApp = async () => {
      const startTime = Date.now();
      try {
        console.log('🚀 [INIT START] Initializing app...');
        
        // iOS optimization setup first (must be early)
        console.log('📱 [iOS] Starting iOS optimization initialization...');
        await initializeAppOptimizations();
        console.log('✓ [iOS] iOS optimizations initialized');
        
        // Database init with timeout (5 seconds max)
        console.log('🔄 [DB] Starting database initialization...');
        const dbInitPromise = initDB();
        const dbTimeout = new Promise((_, reject) =>
          setTimeout(() => {
            reject(new Error('Database initialization exceeded 5 second timeout'));
          }, 5000)
        );

        try {
          await Promise.race([dbInitPromise, dbTimeout]);
          console.log('✓ [DB] Database initialized successfully');
        } catch (dbErr) {
          console.warn('⚠️ [DB] Database initialization warning:', (dbErr as Error).message);
          // App will continue even if DB fails - it might have cached data
        }

        // Image preload in background (don't wait)
        console.log('🖼️ [IMAGES] Starting background image preload...');
        setTimeout(() => {
          getAllProductsForImagePreload()
            .then((products) => {
              if (products?.length > 0) {
                console.log(`📦 [IMAGES] Preloading ${products.length} product images in background...`);
                preloadAllProductImages(products).catch((err) => {
                  console.warn('⚠️ [IMAGES] Background image preload failed:', err);
                });
              }
            })
            .catch((err) => {
              console.warn('⚠️ [IMAGES] Could not fetch products for preload:', err);
            });
        }, 100);

        // Mark ready
        console.log(`✓ [INIT SUCCESS] App ready in ${Date.now() - startTime}ms`);
        setDbReady(true);
        
        // Hide splash screen
        try {
          await SplashScreen.hideAsync();
          console.log('✓ [SPLASH] Splash screen hidden');
        } catch (e) {
          console.warn('⚠️ [SPLASH] Could not hide splash screen:', e);
        }
      } catch (error) {
        console.error('❌ [INIT ERROR] Unexpected error during initialization:', error);
        // Force ready state anyway
        setDbReady(true);
        try {
          await SplashScreen.hideAsync();
        } catch (e) {
          console.warn('⚠️ [SPLASH] Could not hide splash screen on error:', e);
        }
      }
    };

    initializeApp();

    // CRITICAL SAFETY NET: Force app to render after 10 seconds maximum
    // This prevents infinite loading screens
    const safetyTimeoutId = setTimeout(() => {
      if (!initStartedRef.current) {
        console.error('❌ [TIMEOUT] Critical timeout: initialization took too long!');
        setDbReady(true);
        SplashScreen.hideAsync().catch(() => {
          console.warn('⚠️ [SPLASH] Could not hide splash on timeout');
        });
      }
    }, 10000);

    // Cleanup on app exit
    return () => {
      clearTimeout(safetyTimeoutId);
      cleanupOnAppExit().catch(err => 
        console.warn('⚠️ [CLEANUP] Error during app cleanup:', err)
      );
    };
  }, []);

  if (!dbReady) {
    return null; // Return null while loading (splash screen shows)
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <FeatureProvider>
            <RootLayoutNav />
          </FeatureProvider>
        </AuthProvider>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Separate component for navigation to access auth context
function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated and on auth screens
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, navigationState?.key, isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product-detail" options={{ headerShown: false }} />
      <Stack.Screen name="category" options={{ headerShown: false }} />
      <Stack.Screen name="checkout" options={{ headerShown: false }} />
      <Stack.Screen name="order-success" options={{ headerShown: false }} />
      <Stack.Screen name="collection-detail" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="payments" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
