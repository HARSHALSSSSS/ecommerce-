/**
 * Bundle Size & Performance Optimization
 * Dynamic imports, code splitting, lazy loading
 */

import React, { ComponentType } from 'react';
import { View, ActivityIndicator } from 'react-native';

// ============================================
// DYNAMIC IMPORTS & CODE SPLITTING
// ============================================

/**
 * Lazy load components with fallback
 */
interface LazyComponentProps {
  [key: string]: any;
}

const LoadingFallback = () => (
  React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center' } },
    React.createElement(ActivityIndicator, { size: 'large', color: '#E07856' })
  )
);

export const lazyLoadComponent = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  displayName: string,
): React.FC<LazyComponentProps> => {
  return (props: LazyComponentProps) => {
    const [Component, setComponent] = React.useState<T | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      importFn().then((module) => {
        setComponent(() => module.default);
        setLoading(false);
      }).catch((error) => {
        console.error(`Error loading component ${displayName}:`, error);
        setLoading(false);
      });
    }, []);

    if (loading) {
      return LoadingFallback();
    }

    return Component ? React.createElement(Component, props) : LoadingFallback();
  };
};

// ============================================
// API RESPONSE OPTIMIZATION
// ============================================

/**
 * Compress and optimize API responses
 */
export const optimizeApiResponse = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(optimizeApiResponse);
  }

  if (data && typeof data === 'object') {
    const optimized: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip null/undefined values to reduce payload
      if (value === null || value === undefined) {
        continue;
      }
      
      // Remove unused fields
      if (shouldSkipField(key)) {
        continue;
      }
      
      optimized[key] = optimizeApiResponse(value);
    }
    
    return optimized;
  }

  return data;
};

/**
 * Determine which fields to skip
 */
const shouldSkipField = (field: string): boolean => {
  const skipFields = [
    'meta', // metadata not needed on frontend
    '_internal',
    'debug',
    'timestamp_ms', // use timestamp instead
    'created_at_ms',
    'updated_at_ms',
  ];
  
  return skipFields.includes(field);
};

// ============================================
// MEMORY OPTIMIZATION
// ============================================

/**
 * Pagination helper for large lists
 */
export const usePaginatedData = <T,>(
  data: T[],
  pageSize: number = 20,
) => {
  const [currentPage, setCurrentPage] = React.useState(0);

  const paginatedData = React.useMemo(() => {
    const start = currentPage * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const hasMore = (currentPage + 1) * pageSize < data.length;
  const nextPage = () => hasMore && setCurrentPage(p => p + 1);
  const prevPage = () => currentPage > 0 && setCurrentPage(p => p - 1);

  return {
    paginatedData,
    currentPage,
    hasMore,
    nextPage,
    prevPage,
    totalPages: Math.ceil(data.length / pageSize),
  };
};

// ============================================
// MODULE DEFERRED LOADING
// ============================================

/**
 * Defer non-critical module loading
 */
export const deferModuleLoad = async (modulePath: string): Promise<any> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      import(modulePath).then(resolve).catch(console.error);
    }, 1000); // Defer by 1 second
  });
};

// ============================================
// TREE-SHAKEABLE EXPORTS
// ============================================

/**
 * Only export what's needed (helps with tree-shaking)
 */
export const bundleOptimizations = {
  lazyLoadComponent,
  optimizeApiResponse,
  usePaginatedData,
  deferModuleLoad,
};

export default bundleOptimizations;
