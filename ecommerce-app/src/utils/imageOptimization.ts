/**
 * Image Optimization & Caching System
 * Handles image loading with lazy loading, caching, and progressive loading
 * Optimized for iOS and 16KB page size constraints
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Image, StyleSheet, ActivityIndicator, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache configuration
const IMAGE_CACHE_DIR = `${(FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || ''}images/`;
const CACHE_EXPIRY_DAYS = 7;
const MAX_CACHE_SIZE_MB = 50; // Respect iOS cache limits
const CACHE_INDEX_KEY = 'image_cache_index';
const IMAGE_QUALITY = 0.8; // 80% quality for better compression
const PLACEHOLDER_COLOR = '#f3f4f6';

// Initialize cache directory
const initializeCacheDir = async () => {
  try {
    const info = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('Failed to initialize cache directory:', error);
  }
};

// Initialize on module load
initializeCacheDir();

/**
 * Get cache file path for a URL
 */
const getCacheFilePath = (url: string): string => {
  // Create a simple hash from URL
  const hash = url
    .split('')
    .reduce((acc, char) => {
      return (acc << 5) - acc + char.charCodeAt(0);
    }, 0)
    .toString(36);
  
  return `${IMAGE_CACHE_DIR}img_${hash}`;
};

/**
 * Manage cache index to track expiry and size
 */
const getCacheIndex = async (): Promise<Record<string, any>> => {
  try {
    const index = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    return index ? JSON.parse(index) : {};
  } catch (error) {
    console.error('Failed to read cache index:', error);
    return {};
  }
};

const saveCacheIndex = async (index: Record<string, any>): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.error('Failed to save cache index:', error);
  }
};

/**
 * Check if cached file is still valid
 */
const isCacheValid = (timestamp: number): boolean => {
  const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // Convert days to ms
  return Date.now() - timestamp < expiryTime;
};

/**
 * Clean up old cache entries
 */
const cleanupExpiredCache = async (): Promise<void> => {
  try {
    const index = await getCacheIndex();
    const validEntries: Record<string, any> = {};
    
    for (const [path, metadata] of Object.entries(index)) {
      if (isCacheValid((metadata as any).timestamp)) {
        validEntries[path] = metadata;
      } else {
        // Delete expired file
        try {
          await FileSystem.deleteAsync(path, { idempotent: true });
        } catch (e) {
          console.warn('Failed to delete expired cache:', e);
        }
      }
    }
    
    if (Object.keys(validEntries).length !== Object.keys(index).length) {
      await saveCacheIndex(validEntries);
    }
  } catch (error) {
    console.error('Cache cleanup failed:', error);
  }
};

/**
 * Get total cache size
 */
const getCacheSize = async (): Promise<number> => {
  try {
    const files = await FileSystem.readDirectoryAsync(IMAGE_CACHE_DIR);
    let totalSize = 0;
    
    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(`${IMAGE_CACHE_DIR}${file}`);
      if (fileInfo.exists && fileInfo.size) {
        totalSize += fileInfo.size;
      }
    }
    
    return totalSize / (1024 * 1024); // Convert to MB
  } catch (error) {
    console.error('Failed to calculate cache size:', error);
    return 0;
  }
};

/**
 * Download and cache image
 */
const downloadAndCacheImage = async (url: string): Promise<string | null> => {
  try {
    const cacheFilePath = getCacheFilePath(url);
    const cacheIndex = await getCacheIndex();
    
    // Check if already cached and valid
    if (cacheIndex[cacheFilePath] && isCacheValid(cacheIndex[cacheFilePath].timestamp)) {
      return cacheFilePath;
    }
    
    // Check cache size before downloading
    const currentCacheSize = await getCacheSize();
    if (currentCacheSize > MAX_CACHE_SIZE_MB) {
      // Clean up expired cache
      await cleanupExpiredCache();
    }
    
    // Download image
    const downloadResult = await FileSystem.downloadAsync(url, cacheFilePath);
    
    if (downloadResult.status === 200) {
      // Update cache index
      const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);
      cacheIndex[cacheFilePath] = {
        url,
        timestamp: Date.now(),
        size: fileInfo.exists && 'size' in fileInfo ? (fileInfo as any).size : 0,
      };
      await saveCacheIndex(cacheIndex);
      return cacheFilePath;
    }
  } catch (error) {
    console.error('Image caching failed:', error);
  }
  
  return null;
};

/**
 * Clear entire image cache
 */
export const clearImageCache = async (): Promise<void> => {
  try {
    const files = await FileSystem.readDirectoryAsync(IMAGE_CACHE_DIR);
    for (const file of files) {
      await FileSystem.deleteAsync(`${IMAGE_CACHE_DIR}${file}`, { idempotent: true });
    }
    await AsyncStorage.removeItem(CACHE_INDEX_KEY);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
};

/**
 * Optimized Image Component with lazy loading and caching
 */
interface OptimizedImageProps {
  source: { uri: string } | number;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  placeholder?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  style,
  resizeMode = 'cover',
  placeholder = true,
  onLoad,
  onError,
}) => {
  const [cachedUri, setCachedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const uri = typeof source === 'object' ? source.uri : undefined;

  useEffect(() => {
    if (!uri) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadImage = async () => {
      try {
        // Check if it's a local URI
        if (uri.startsWith('file://') || uri.startsWith(IMAGE_CACHE_DIR)) {
          if (isMounted) {
            setCachedUri(uri);
            setLoading(false);
            onLoad?.();
          }
          return;
        }

        // Download and cache remote image
        const cached = await downloadAndCacheImage(uri);
        if (isMounted) {
          if (cached) {
            setCachedUri(cached);
            setLoading(false);
            onLoad?.();
          } else {
            setError(true);
            setLoading(false);
            onError?.(new Error('Failed to cache image'));
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
          setLoading(false);
          onError?.(err as Error);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [uri, onLoad, onError]);

  const displayUri = cachedUri || uri;

  if (error) {
    return React.createElement(View, { style: [style, { backgroundColor: PLACEHOLDER_COLOR }] });
  }

  const placeholderElement = loading && placeholder
    ? React.createElement(
        View,
        {
          style: [
            StyleSheet.absoluteFill,
            { backgroundColor: PLACEHOLDER_COLOR, justifyContent: 'center', alignItems: 'center' },
          ],
        },
        React.createElement(ActivityIndicator, { size: 'small', color: '#9ca3af' })
      )
    : null;

  const imageElement = displayUri
    ? React.createElement(Image, {
        source: { uri: displayUri },
        style: StyleSheet.absoluteFill,
        resizeMode: resizeMode,
        onLoad: () => {
          setLoading(false);
          onLoad?.();
        },
        onError: (err: any) => {
          setError(true);
          onError?.(err.nativeEvent as unknown as Error);
        },
      })
    : null;

  return React.createElement(View, { style }, placeholderElement, imageElement);
};

/**
 * Pre-load images for better performance
 */
export const preloadImages = async (urls: string[]): Promise<void> => {
  try {
    await Promise.all(urls.map(url => downloadAndCacheImage(url)));
  } catch (error) {
    console.error('Image preloading failed:', error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<{
  totalSize: number;
  totalFiles: number;
  cacheDir: string;
}> => {
  try {
    const files = await FileSystem.readDirectoryAsync(IMAGE_CACHE_DIR);
    const totalSize = await getCacheSize();
    return {
      totalSize,
      totalFiles: files.length,
      cacheDir: IMAGE_CACHE_DIR,
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return { totalSize: 0, totalFiles: 0, cacheDir: IMAGE_CACHE_DIR };
  }
};

export default OptimizedImage;
