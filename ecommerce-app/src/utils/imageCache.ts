import { Image } from 'react-native';

// Image cache manager for faster loading
const imageCache = new Map<string, { success: boolean; timestamp: number }>();
const imageQueueSet = new Set<string>();
const preloadPromiseMap = new Map<string, Promise<boolean>>();

export const validateImageUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return false;
  }
  
  try {
    // Check if URL starts with http:// or https://
    const trimmed = url.trim();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://');
  } catch {
    return false;
  }
};

export const preloadImage = (url: string): Promise<boolean> => {
  if (!validateImageUrl(url)) {
    return Promise.resolve(false);
  }

  const normalizedUrl = url.trim();
  
  // Return existing promise if already preloading
  if (preloadPromiseMap.has(normalizedUrl)) {
    return preloadPromiseMap.get(normalizedUrl)!;
  }

  // Return cached result if already loaded
  if (imageCache.has(normalizedUrl)) {
    const cached = imageCache.get(normalizedUrl);
    if (cached && cached.success) {
      return Promise.resolve(true);
    }
  }

  // Create new preload promise
  const promise = new Promise<boolean>((resolve) => {
    imageQueueSet.add(normalizedUrl);

    // FAST timeout: 2 seconds per image (was 3)
    const timeoutId = setTimeout(() => {
      imageQueueSet.delete(normalizedUrl);
      imageCache.set(normalizedUrl, { success: false, timestamp: Date.now() });
      preloadPromiseMap.delete(normalizedUrl);
      resolve(false);
    }, 2000);

    Image.prefetch(normalizedUrl)
      .then(() => {
        clearTimeout(timeoutId);
        imageCache.set(normalizedUrl, { success: true, timestamp: Date.now() });
        imageQueueSet.delete(normalizedUrl);
        preloadPromiseMap.delete(normalizedUrl);
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        imageCache.set(normalizedUrl, { success: false, timestamp: Date.now() });
        imageQueueSet.delete(normalizedUrl);
        preloadPromiseMap.delete(normalizedUrl);
        resolve(false);
      });
  });

  preloadPromiseMap.set(normalizedUrl, promise);
  return promise;
};

export const preloadImages = async (urls: string[]): Promise<number> => {
  if (!urls || urls.length === 0) {
    return 0;
  }

  const validUrls = urls.filter(url => validateImageUrl(url));
  
  if (validUrls.length === 0) {
    return 0;
  }

  // AGGRESSIVE: Load more images in parallel (6 instead of 3)
  const batchSize = 6;
  let successCount = 0;

  for (let i = 0; i < validUrls.length; i += batchSize) {
    const batch = validUrls.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(url => preloadImage(url)));
    successCount += results.filter(Boolean).length;
  }

  return successCount;
};

export const preloadAllProductImages = async (products: any[]): Promise<number> => {
  if (!Array.isArray(products)) {
    console.warn('Products is not an array');
    return 0;
  }

  const imageUrls = products
    .filter(p => p && p.image_url)
    .map(p => p.image_url)
    .filter(url => validateImageUrl(url)) as string[];

  if (imageUrls.length === 0) {
    console.warn('No valid product images found');
    return 0;
  }

  console.log(`📦 Preloading ${imageUrls.length} product images...`);
  return preloadImages(imageUrls);
};

export const getImageUri = (url: string): string | null => {
  if (validateImageUrl(url)) {
    return url.trim();
  }
  return null;
};

export const isImageCached = (url: string): boolean => {
  if (!validateImageUrl(url)) {
    return false;
  }
  
  const normalizedUrl = url.trim();
  const cached = imageCache.get(normalizedUrl);
  return cached ? cached.success : false;
};

export const getCacheStats = () => {
  let successCount = 0;
  let failureCount = 0;
  let totalSize = 0;

  imageCache.forEach(({ success }) => {
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
    totalSize++;
  });

  return {
    totalCached: totalSize,
    successCount,
    failureCount,
    queueSize: imageQueueSet.size,
  };
};

export const clearImageCache = () => {
  imageCache.clear();
  imageQueueSet.clear();
  console.log('Image cache cleared');
};
