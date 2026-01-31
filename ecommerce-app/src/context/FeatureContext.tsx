import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { featureTogglesAPI, storeSettingsAPI } from '../services/api';

interface FeatureFlags {
  [key: string]: boolean;
}

interface StoreSettings {
  [key: string]: any;
}

interface FeatureContextType {
  features: FeatureFlags;
  settings: StoreSettings;
  isLoading: boolean;
  isFeatureEnabled: (featureKey: string) => boolean;
  getSetting: (key: string, defaultValue?: any) => any;
  refreshFeatures: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

const FEATURES_CACHE_KEY = '@feature_toggles';
const SETTINGS_CACHE_KEY = '@store_settings';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface FeatureProviderProps {
  children: ReactNode;
}

export function FeatureProvider({ children }: FeatureProviderProps) {
  const [features, setFeatures] = useState<FeatureFlags>({});
  const [settings, setSettings] = useState<StoreSettings>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCachedData();
    refreshFeatures();
    refreshSettings();
  }, []);

  const loadCachedData = async () => {
    try {
      const [cachedFeatures, cachedSettings] = await Promise.all([
        AsyncStorage.getItem(FEATURES_CACHE_KEY),
        AsyncStorage.getItem(SETTINGS_CACHE_KEY),
      ]);

      if (cachedFeatures) {
        const parsed = JSON.parse(cachedFeatures);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          setFeatures(parsed.data);
        }
      }

      if (cachedSettings) {
        const parsed = JSON.parse(cachedSettings);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          setSettings(parsed.data);
        }
      }
    } catch (error) {
      console.error('Error loading cached feature data:', error);
    }
  };

  const refreshFeatures = async () => {
    try {
      // Get user ID if logged in
      const userStr = await AsyncStorage.getItem('user');
      const userId = userStr ? JSON.parse(userStr).id : undefined;

      const response = await featureTogglesAPI.checkAll(userId);
      if (response.success) {
        setFeatures(response.data);
        // Cache the features
        await AsyncStorage.setItem(
          FEATURES_CACHE_KEY,
          JSON.stringify({ data: response.data, timestamp: Date.now() })
        );
      }
    } catch (error) {
      console.error('Error fetching feature toggles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSettings = async () => {
    try {
      const response = await storeSettingsAPI.getPublic();
      if (response.success) {
        setSettings(response.data);
        // Cache the settings
        await AsyncStorage.setItem(
          SETTINGS_CACHE_KEY,
          JSON.stringify({ data: response.data, timestamp: Date.now() })
        );
      }
    } catch (error) {
      console.error('Error fetching store settings:', error);
    }
  };

  const isFeatureEnabled = (featureKey: string): boolean => {
    // Default to true if feature not found (fail-open for unknown features)
    return features[featureKey] !== false;
  };

  const getSetting = (key: string, defaultValue: any = null): any => {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  };

  const value: FeatureContextType = {
    features,
    settings,
    isLoading,
    isFeatureEnabled,
    getSetting,
    refreshFeatures,
    refreshSettings,
  };

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeatures(): FeatureContextType {
  const context = useContext(FeatureContext);
  if (context === undefined) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
}

// Helper hook for checking a single feature
export function useFeature(featureKey: string): boolean {
  const { isFeatureEnabled } = useFeatures();
  return isFeatureEnabled(featureKey);
}

// Helper hook for getting a setting
export function useSetting(key: string, defaultValue?: any): any {
  const { getSetting } = useFeatures();
  return getSetting(key, defaultValue);
}

export default FeatureContext;
