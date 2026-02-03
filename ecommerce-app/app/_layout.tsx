import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
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

// Keep splash screen visible while we load
SplashScreen.preventAutoHideAsync().catch(() => {});

// Brand colors matching the app theme
const BRAND_COLOR = '#E07856';

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const initStartedRef = useRef(false);

  const hideSplash = useCallback(async () => {
    if (splashHidden) return;
    try {
      await SplashScreen.hideAsync();
      setSplashHidden(true);
    } catch (e) {
      setSplashHidden(true);
    }
  }, [splashHidden]);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const initializeApp = async () => {
      const startTime = Date.now();
      
      try {
        // Run optimizations and database init in parallel for speed
        await Promise.race([
          Promise.all([
            initializeAppOptimizations().catch(() => {}),
            initDB().catch(() => {}),
          ]),
          new Promise(resolve => setTimeout(resolve, 2000)) // Max 2 seconds wait
        ]);

        console.log(`App initialized in ${Date.now() - startTime}ms`);
      } catch (error) {
        console.warn('Init error (continuing):', error);
      }
      
      // App is ready
      setAppReady(true);
      
      // Hide splash after UI is painted
      setTimeout(hideSplash, 50);
      
      // Background: preload images (non-blocking)
      setTimeout(() => {
        getAllProductsForImagePreload()
          .then(products => {
            if (products?.length > 0) {
              preloadAllProductImages(products);
            }
          })
          .catch(() => {});
      }, 500);
    };

    initializeApp();

    // Safety timeout: ensure app renders within 3 seconds max
    const safetyTimeout = setTimeout(() => {
      setAppReady(true);
      hideSplash();
    }, 3000);

    return () => {
      clearTimeout(safetyTimeout);
      cleanupOnAppExit().catch(() => {});
    };
  }, [hideSplash]);

  // Show branded loading screen instead of white/null
  if (!appReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <View style={styles.loadingContent}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoText}>🛍️</Text>
          </View>
          <Text style={styles.appName}>Agumentix</Text>
          <ActivityIndicator size="large" color={BRAND_COLOR} style={styles.spinner} />
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
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

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, navigationState?.key, isLoading]);

  // Show loading with branded background instead of white
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
      </View>
    );
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: BRAND_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 40,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 24,
  },
  spinner: {
    marginTop: 8,
  },
});
