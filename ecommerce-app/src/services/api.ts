import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ============================================
// API CONFIGURATION - PRODUCTION READY
// ============================================

// PRODUCTION URL - Always use this for APK/release builds
const PRODUCTION_API_URL = 'https://ecommerce-4ifc.onrender.com/api';

// Detect if running in Expo Go (development) or standalone app (production)
const isExpoGo = Constants.appOwnership === 'expo';
// For APK builds, appOwnership is null or undefined (not 'expo')
const isStandaloneBuild = !isExpoGo;
const isDevelopment = __DEV__ && isExpoGo;

// For APK/standalone builds, ALWAYS use production URL
const API_URL = isStandaloneBuild || !__DEV__
  ? PRODUCTION_API_URL
  : isDevelopment
    ? (() => {
        // For Expo Go on real device, use the debuggerHost to get the computer's IP
        try {
          const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
          if (debuggerHost) {
            const hostIp = debuggerHost.split(':')[0];
            return `http://${hostIp}:5000/api`;
          }
        } catch (e) {
          console.log('Could not get debugger host, using production URL');
        }
        if (Platform.OS === 'android') {
          return 'http://10.0.2.2:5000/api'; // Android emulator fallback
        } else if (Platform.OS === 'ios') {
          return 'http://localhost:5000/api'; // iOS simulator
        }
        return PRODUCTION_API_URL;
      })()
    : PRODUCTION_API_URL;

console.log('🌐 API Configuration:');
console.log('   URL:', API_URL);
console.log('   isDev:', isDevelopment);
console.log('   isExpoGo:', isExpoGo);
console.log('   isStandalone:', isStandaloneBuild);
console.log('   __DEV__:', __DEV__);

// Fixed timeout - don't use async initialization that can fail
const API_TIMEOUT = 30000; // 30 seconds

const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request queue for limiting concurrent requests
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  private maxConcurrent = 3;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          this.activeRequests++;
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      };

      if (this.activeRequests < this.maxConcurrent) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private processQueue() {
    if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const fn = this.queue.shift();
      if (fn) {
        fn();
      }
    }
  }

  setMaxConcurrent(max: number) {
    this.maxConcurrent = max;
  }
}

const requestQueue = new RequestQueue();

// Request interceptor for auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      console.log('📤 API Request:', config.method?.toUpperCase(), config.url, '| Token:', token ? 'Yes' : 'No');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.log('Could not get auth token:', e);
    }
    return config;
  },
  (error) => {
    console.error('📤 Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('📥 API Response:', response.config.url, '| Status:', response.status);
    return response;
  },
  async (error) => {
    console.error('📥 API Error:', error.config?.url, '| Status:', error.response?.status, '| Message:', error.message);
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Products API
export const productsAPI = {
  getAll: async (params?: { category?: string; search?: string; limit?: number; visible?: boolean }) => {
    return requestQueue.add(async () => {
      const response = await api.get('/products', { params: { ...params, limit: 100, visible: true, _t: Date.now() } });
      return response.data;
    });
  },

  getById: async (id: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/products/${id}`, { params: { _t: Date.now() } });
      return response.data;
    });
  },

  getByCategory: async (category: string) => {
    return requestQueue.add(async () => {
      const response = await api.get('/products', { params: { category, limit: 100, visible: true, _t: Date.now() } });
      return response.data;
    });
  },

  search: async (query: string) => {
    return requestQueue.add(async () => {
      const response = await api.get('/products', { params: { search: query, limit: 50, visible: true, _t: Date.now() } });
      return response.data;
    });
  },
};

// Categories API
export const categoriesAPI = {
  getAll: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/categories');
      return response.data;
    });
  },

  getById: async (id: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/categories/${id}`);
      return response.data;
    });
  },
};

// Stores API
export const storesAPI = {
  getAll: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/stores', { params: { limit: 50 } });
      return response.data;
    });
  },

  getById: async (id: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/stores/${id}`);
      return response.data;
    });
  },
};

// User Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    return requestQueue.add(async () => {
      const response = await api.post('/auth/user/login', { email, password });
      if (response.data.success) {
        await AsyncStorage.setItem('userToken', response.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        setTimeout(() => {
          api.post(`/admin/users/${response.data.user.id}/activity`, {
            action: 'User logged in',
            action_type: 'auth',
            device_info: Platform.OS,
          }).catch(() => {});
        }, 100);
      }
      return response.data;
    });
  },

  register: async (name: string, email: string, password: string) => {
    return requestQueue.add(async () => {
      const response = await api.post('/auth/user/register', { name, email, password });
      if (response.data.success) {
        await AsyncStorage.setItem('userToken', response.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        setTimeout(() => {
          api.post(`/admin/users/${response.data.user.id}/activity`, {
            action: 'User registered',
            action_type: 'auth',
            device_info: Platform.OS,
          }).catch(() => {});
        }, 100);
      }
      return response.data;
    });
  },

  logout: async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        await api.post(`/admin/users/${user.id}/activity`, {
          action: 'User logged out',
          action_type: 'auth',
          device_info: Platform.OS,
        });
      }
    } catch (e) {}
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('user');
  },

  getProfile: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/auth/user/profile');
      return response.data;
    });
  },

  updateProfile: async (data: { name?: string; phone?: string; address?: string; city?: string }) => {
    return requestQueue.add(async () => {
      const response = await api.put('/auth/user/profile', data);
      return response.data;
    });
  },
};

// Cart API (uses local storage + syncs with backend when user is logged in)
export const cartAPI = {
  get: async () => {
    try {
      return requestQueue.add(async () => {
        const response = await api.get('/cart');
        return response.data;
      });
    } catch (error) {
      return { success: true, cart: { items: [], subtotal: 0, item_count: 0 } };
    }
  },

  addItem: async (productId: number, quantity: number = 1, size?: string) => {
    return requestQueue.add(async () => {
      const response = await api.post('/cart/add', { product_id: productId, quantity });
      return response.data;
    });
  },

  updateQuantity: async (cartItemId: number, quantity: number) => {
    return requestQueue.add(async () => {
      const response = await api.put(`/cart/${cartItemId}`, { quantity });
      return response.data;
    });
  },

  removeItem: async (cartItemId: number) => {
    return requestQueue.add(async () => {
      const response = await api.delete(`/cart/${cartItemId}`);
      return response.data;
    });
  },

  clear: async () => {
    return requestQueue.add(async () => {
      const response = await api.delete('/cart');
      return response.data;
    });
  },
};

// Orders API
export const ordersAPI = {
  create: async (orderData: {
    items: { product_id: number; quantity: number }[];
    delivery_address: string;
    city: string;
    postal_code?: string;
    payment_method: string;
    notes?: string;
  }) => {
    return requestQueue.add(async () => {
      const response = await api.post('/orders', orderData, { timeout: 60000 });
      return response.data;
    });
  },

  getAll: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/orders/my-orders');
      return response.data;
    });
  },

  getById: async (id: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/orders/my-orders/${id}`);
      return response.data;
    });
  },

  getTimeline: async (id: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/orders/my-orders/${id}`);
      return response.data;
    });
  },

  cancel: async (id: number, reason?: string) => {
    return requestQueue.add(async () => {
      const response = await api.post(`/orders/my-orders/${id}/cancel`, { reason });
      return response.data;
    });
  },

  requestRefund: async (id: number, reason: string) => {
    return requestQueue.add(async () => {
      const response = await api.post(`/orders/my-orders/${id}/refund-request`, { reason });
      return response.data;
    });
  },
  
  getLatest: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/orders/my-orders', { params: { limit: 1 } });
      return response.data;
    });
  },
};

// User Activity Tracking API
export const activityAPI = {
  log: async (action: string, actionType: string, metadata?: Record<string, unknown>) => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) return;
      const user = JSON.parse(userStr);
      return requestQueue.add(async () => {
        await api.post(`/admin/users/${user.id}/activity`, {
          action,
          action_type: actionType,
          device_info: Platform.OS,
          metadata,
        });
      });
    } catch (error) {
      console.log('Activity log failed:', error);
    }
  },

  logLogin: () => activityAPI.log('User logged in', 'auth'),
  logLogout: () => activityAPI.log('User logged out', 'auth'),
  logViewProduct: (productId: number, productName: string) => 
    activityAPI.log(`Viewed product: ${productName}`, 'browse', { productId }),
  logAddToCart: (productId: number, productName: string) => 
    activityAPI.log(`Added to cart: ${productName}`, 'cart', { productId }),
  logCheckout: (orderId: number, amount: number) => 
    activityAPI.log(`Completed checkout`, 'order', { orderId, amount }),
  logSearch: (query: string) => 
    activityAPI.log(`Searched: ${query}`, 'search', { query }),
};

// Notification Preferences API
export const notificationAPI = {
  getPreferences: async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) return null;
      const user = JSON.parse(userStr);
      return requestQueue.add(async () => {
        const response = await api.get(`/admin/users/${user.id}/preferences`);
        return response.data;
      });
    } catch (error) {
      return null;
    }
  },

  updatePreferences: async (preferences: {
    email_marketing?: boolean;
    email_orders?: boolean;
    push_enabled?: boolean;
    push_orders?: boolean;
    push_promotions?: boolean;
    sms_enabled?: boolean;
  }) => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) return null;
      const user = JSON.parse(userStr);
      return requestQueue.add(async () => {
        const response = await api.put(`/users/${user.id}/preferences`, preferences);
        return response.data;
      });
    } catch (error) {
      return null;
    }
  },
};

// Shipment Tracking API
export const shipmentsAPI = {
  getTracking: async (orderId: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/shipments/tracking/${orderId}`);
      return response.data;
    });
  },
};

// Returns API
export const returnsAPI = {
  getReasons: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/returns/reasons');
      return response.data;
    });
  },

  getActions: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/returns/actions');
      return response.data;
    });
  },

  create: async (data: {
    order_id: number;
    reason_code: string;
    requested_action: string;
    reason_text?: string;
    pickup_address?: string;
  }) => {
    return requestQueue.add(async () => {
      const response = await api.post('/returns/request', data);
      return response.data;
    });
  },

  getMyReturns: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/returns/my-returns');
      return response.data;
    });
  },

  getById: async (id: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/returns/my-returns/${id}`);
      return response.data;
    });
  },
};

// Refunds API
export const refundsAPI = {
  getMyRefunds: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/refunds/my-refunds');
      return response.data;
    });
  },

  getByOrder: async (orderId: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/refunds/order/${orderId}`);
      return response.data;
    });
  },
};

// Replacements API
export const replacementsAPI = {
  getMyReplacements: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/replacements/my-replacements');
      return response.data;
    });
  },

  getByOrder: async (orderId: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/replacements/order/${orderId}`);
      return response.data;
    });
  },
};

// Tickets API (Support/Grievance)
export const ticketsAPI = {
  getCategories: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/tickets/categories');
      return response.data;
    });
  },

  getPriorities: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/tickets/priorities');
      return response.data;
    });
  },

  getStatuses: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/tickets/statuses');
      return response.data;
    });
  },

  create: async (data: {
    subject: string;
    description: string;
    category?: string;
    priority?: string;
    order_id?: number;
  }) => {
    return requestQueue.add(async () => {
      const response = await api.post('/tickets', data);
      return response.data;
    });
  },

  getMyTickets: async (params?: { status?: string; page?: number; limit?: number }) => {
    return requestQueue.add(async () => {
      const response = await api.get('/tickets/my-tickets', { params });
      return response.data;
    });
  },

  getById: async (id: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/tickets/my-tickets/${id}`);
      return response.data;
    });
  },

  reply: async (id: number, message: string) => {
    return requestQueue.add(async () => {
      const response = await api.post(`/tickets/${id}/reply`, { message });
      return response.data;
    });
  },
};

// Payments API (Phase 7)
export const paymentsAPI = {
  getHistory: async (params?: { page?: number; limit?: number }) => {
    return requestQueue.add(async () => {
      const response = await api.get('/payments/user/history', { params });
      return response.data;
    });
  },

  getById: async (id: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/payments/user/${id}`);
      return response.data;
    });
  },
};

// Invoices API (Phase 7)
export const invoicesAPI = {
  getList: async (params?: { page?: number; limit?: number }) => {
    return requestQueue.add(async () => {
      const response = await api.get('/invoices/user/list', { params });
      return response.data;
    });
  },

  getById: async (id: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/invoices/user/${id}`);
      return response.data;
    });
  },
};

// Credit Notes API (Phase 7)
export const creditNotesAPI = {
  getList: async (params?: { page?: number; limit?: number }) => {
    return requestQueue.add(async () => {
      const response = await api.get('/credit-notes/user/list', { params });
      return response.data;
    });
  },

  getById: async (id: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/credit-notes/user/${id}`);
      return response.data;
    });
  },
};

// Notifications API (Phase 7)
export const notificationsAPI = {
  getList: async (params?: { page?: number; limit?: number; unread_only?: boolean }) => {
    return requestQueue.add(async () => {
      const response = await api.get('/notifications/user/list', { params });
      return response.data;
    });
  },

  getUnreadCount: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/notifications/user/unread-count');
      return response.data;
    });
  },

  markAsRead: async (id: number) => {
    return requestQueue.add(async () => {
      const response = await api.patch(`/notifications/user/${id}/read`);
      return response.data;
    });
  },

  markAllAsRead: async () => {
    return requestQueue.add(async () => {
      const response = await api.patch('/notifications/user/read-all');
      return response.data;
    });
  },

  getPreferences: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/notifications/user/preferences');
      return response.data;
    });
  },

  updatePreferences: async (preferences: {
    order_updates?: boolean;
    shipping_updates?: boolean;
    payment_updates?: boolean;
    promotional?: boolean;
    email_enabled?: boolean;
    push_enabled?: boolean;
    sms_enabled?: boolean;
  }) => {
    return requestQueue.add(async () => {
      const response = await api.put('/notifications/user/preferences', preferences);
      return response.data;
    });
  },

  registerPushToken: async (token: string, deviceType?: string, deviceName?: string) => {
    return requestQueue.add(async () => {
      const response = await api.post('/notifications/push-token', { 
        token, 
        device_type: deviceType,
        device_name: deviceName 
      });
      return response.data;
    });
  },

  unregisterPushToken: async (token: string) => {
    return requestQueue.add(async () => {
      const response = await api.delete('/notifications/push-token', { data: { token } });
      return response.data;
    });
  },

  getPushTokens: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/notifications/push-tokens');
      return response.data;
    });
  },
};

// Marketing Preferences API (Phase 8)
export const marketingAPI = {
  getPreferences: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/campaigns/preferences/user');
      return response.data;
    });
  },

  updatePreferences: async (preferences: {
    email_marketing?: boolean;
    push_marketing?: boolean;
    sms_marketing?: boolean;
    category_preferences?: number[];
  }) => {
    return requestQueue.add(async () => {
      const response = await api.put('/campaigns/preferences/user', preferences);
      return response.data;
    });
  },
};

// Feature Toggles API (Phase 9)
export const featureTogglesAPI = {
  checkAll: async (userId?: number) => {
    return requestQueue.add(async () => {
      const response = await api.get('/features/public/check', { params: { user_id: userId } });
      return response.data;
    });
  },

  check: async (featureKey: string, userId?: number) => {
    return requestQueue.add(async () => {
      const response = await api.get(`/features/public/check/${featureKey}`, { params: { user_id: userId } });
      return response.data;
    });
  },
};

// Store Settings API (Phase 9)
export const storeSettingsAPI = {
  getPublic: async () => {
    return requestQueue.add(async () => {
      const response = await api.get('/settings/public/app');
      return response.data;
    });
  },
};

export default api;
