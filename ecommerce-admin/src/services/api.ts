import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('adminToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('admin')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// Auth API
export const authAPI = {
  login: (email: string, password: string, captchaToken: string) =>
    api.post('/auth/admin/login', { email, password, captchaToken }),

  logout: () => api.post('/auth/admin/logout'),

  forgotPassword: (email: string, captchaToken: string) =>
    api.post('/auth/admin/forgot-password', { email, captchaToken }),

  resetPassword: (token: string, newPassword: string, confirmPassword: string) =>
    api.post('/auth/admin/reset-password', { token, newPassword, confirmPassword }),

  verifyToken: () => api.get('/auth/admin/verify-token'),
}

// Products API
export const productsAPI = {
  getAll: (params?: { page?: number; limit?: number; category?: string; search?: string }) =>
    api.get('/products', { params }),

  getById: (id: number) => api.get(`/products/${id}`),

  create: (data: FormData | Record<string, unknown>) => {
    if (data instanceof FormData) {
      return api.post('/products', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/products', data);
  },

  update: (id: number, data: FormData | Record<string, unknown>) => {
    if (data instanceof FormData) {
      return api.put(`/products/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/products/${id}`, data);
  },

  delete: (id: number) => api.delete(`/products/${id}`),
}

// Users API
export const usersAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/users', { params }),

  getById: (id: number) => api.get(`/users/${id}`),

  update: (id: number, data: object) => api.put(`/users/${id}`, data),

  delete: (id: number) => api.delete(`/users/${id}`),

  toggleActive: (id: number) => api.patch(`/users/${id}/toggle-active`),
}

// Stores API
export const storesAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/stores', { params }),

  getById: (id: number) => api.get(`/stores/${id}`),

  create: (data: FormData) =>
    api.post('/stores', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id: number, data: FormData) =>
    api.put(`/stores/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  delete: (id: number) => api.delete(`/stores/${id}`),
}

// Dashboard API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getRecentOrders: () => api.get('/dashboard/recent-orders'),
  getSalesChart: (period?: string) => api.get('/dashboard/sales-chart', { params: { period } }),
  getTopProducts: () => api.get('/dashboard/top-products'),
}

// RBAC - Roles API
export const rolesAPI = {
  getAll: () => api.get('/rbac/roles'),
  getById: (id: number) => api.get(`/rbac/roles/${id}`),
  create: (data: { name: string; display_name: string; description?: string; permissions?: number[] }) =>
    api.post('/rbac/roles', data),
  update: (id: number, data: { display_name?: string; description?: string; permissions?: number[]; is_active?: boolean }) =>
    api.put(`/rbac/roles/${id}`, data),
  delete: (id: number) => api.delete(`/rbac/roles/${id}`),
}

// RBAC - Permissions API
export const permissionsAPI = {
  getAll: () => api.get('/rbac/permissions'),
  getMatrix: (roleId: number) => api.get(`/rbac/permissions/matrix/${roleId}`),
  updateMatrix: (roleId: number, permissions: number[]) =>
    api.put(`/rbac/permissions/matrix/${roleId}`, { permissions }),
}

// RBAC - Admin Users API
export const adminUsersAPI = {
  getAll: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/rbac/admins', { params }),
  getById: (id: number) => api.get(`/rbac/admins/${id}`),
  create: (data: { email: string; password: string; name: string; roleIds?: number[] }) =>
    api.post('/rbac/admins', data),
  update: (id: number, data: { name?: string; is_active?: boolean; roleIds?: number[] }) =>
    api.put(`/rbac/admins/${id}`, data),
  updateStatus: (id: number, is_active: boolean) =>
    api.patch(`/rbac/admins/${id}/status`, { is_active }),
}

// Sessions API
export const sessionsAPI = {
  getAll: () => api.get('/rbac/sessions'),
  getByAdmin: (adminId: number) => api.get(`/rbac/sessions/admin/${adminId}`),
  forceLogout: (sessionId: number) => api.delete(`/rbac/sessions/${sessionId}`),
  forceLogoutAll: (adminId: number) => api.delete(`/rbac/sessions/admin/${adminId}/all`),
}

// Activity Logs API
export const logsAPI = {
  getAll: (params?: { page?: number; limit?: number; admin_id?: number; action?: string; resource_type?: string }) =>
    api.get('/rbac/logs', { params }),
}

// Customer Management API
export const customersAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get('/admin/users', { params }),
  getById: (id: number, showPII?: boolean) =>
    api.get(`/admin/users/${id}`, { params: { showPII } }),
  getStats: () => api.get('/admin/stats/users'),
  block: (id: number, reason: string) =>
    api.post(`/admin/users/${id}/block`, { reason }),
  unblock: (id: number, reason: string) =>
    api.post(`/admin/users/${id}/unblock`, { reason }),
  getActivity: (id: number, params?: { page?: number; limit?: number; actionType?: string }) =>
    api.get(`/admin/users/${id}/activity`, { params }),
  getPreferences: (id: number) =>
    api.get(`/admin/users/${id}/preferences`),
}

// Support Tickets API
export const ticketsAPI = {
  getAll: (params?: { page?: number; limit?: number; status?: string; priority?: string }) =>
    api.get('/tickets/admin', { params }),
  getById: (id: number) => api.get(`/tickets/admin/${id}`),
  update: (id: number, data: { status?: string; priority?: string; assigned_to?: number | null }) =>
    api.put(`/tickets/admin/${id}`, data),
  addMessage: (id: number, message: string) =>
    api.post(`/tickets/admin/${id}/reply`, { message }),
  getStats: () => api.get('/tickets/admin/stats'),
}
// Categories API
export const categoriesAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get('/categories/admin/list', { params }),
  getStats: () => api.get('/categories/admin/stats'),
  getById: (id: number) => api.get(`/categories/${id}`),
  create: (data: { name: string; description?: string; image_url?: string; parent_id?: number | null; display_order?: number }) =>
    api.post('/categories/admin', data),
  update: (id: number, data: { name?: string; description?: string; image_url?: string; parent_id?: number | null; display_order?: number; is_active?: number }) =>
    api.put(`/categories/admin/${id}`, data),
  toggle: (id: number) => api.post(`/categories/admin/${id}/toggle`),
  delete: (id: number) => api.delete(`/categories/admin/${id}`),
}

// Product Management API
export const productManagementAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string; category?: string; status?: string; stockStatus?: string; sortBy?: string; sortOrder?: string }) =>
    api.get('/admin/products', { params }),
  getStats: () => api.get('/admin/products/stats'),
  getById: (id: number) => api.get(`/admin/products/${id}`),
  create: (data: { name: string; description?: string; price: number; discount_percent?: number; category_id?: number | null; category?: string; image_url?: string; store_id?: number | null; stock_quantity?: number; sku?: string; is_active?: number; is_visible?: number; low_stock_threshold?: number; reorder_quantity?: number }) =>
    api.post('/admin/products', data),
  update: (id: number, data: { name?: string; description?: string; price?: number; discount_percent?: number; category_id?: number | null; category?: string; image_url?: string; store_id?: number | null; stock_quantity?: number; sku?: string; is_active?: number; is_visible?: number; low_stock_threshold?: number; reorder_quantity?: number }) =>
    api.put(`/admin/products/${id}`, data),
  toggleVisibility: (id: number) => api.post(`/admin/products/${id}/toggle-visibility`),
  show: (id: number) => api.post(`/admin/products/${id}/show`),
  hide: (id: number) => api.post(`/admin/products/${id}/hide`),
  bulkVisibility: (product_ids: number[], action: 'show' | 'hide') =>
    api.post('/admin/products/bulk-visibility', { product_ids, action }),
  bulkVisibilityCSV: async (file: File, action: 'show' | 'hide') => {
    // Read file content as text
    const text = await file.text()
    return api.post('/admin/products/bulk-visibility-csv', { csvData: text, action })
  },
}

// Inventory Management API
export const inventoryAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string; stockStatus?: string }) =>
    api.get('/admin/inventory', { params }),
  getAlerts: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/admin/inventory/alerts', { params }),
  getLogs: (params?: { page?: number; limit?: number; productId?: number; changeType?: string }) =>
    api.get('/admin/inventory/logs', { params }),
  updateStock: (productId: number, data: { quantity: number; change_type?: 'set' | 'add' | 'subtract'; reason?: string; low_stock_threshold?: number; reorder_quantity?: number }) =>
    api.put(`/admin/inventory/${productId}`, data),
  bulkUpdate: (updates: { product_id: number; quantity: number; change_type: 'set' | 'add' | 'subtract'; reason?: string }[]) =>
    api.post('/admin/inventory/bulk-update', { updates }),
  resolveAlert: (alertId: number) =>
    api.post(`/admin/inventory/alerts/${alertId}/resolve`),
}

// Order Management API
export const ordersAPI = {
  // Get all orders with filters
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    customer_id?: number;
    date_from?: string;
    date_to?: string;
    sla_status?: string;
    sort_by?: string;
    sort_order?: string;
  }) => api.get('/admin/orders', { params: { ...params, _t: Date.now() } }),
  
  // Get order statistics
  getStats: () => api.get('/admin/orders/stats', { params: { _t: Date.now() } }),
  
  // Get single order details
  getById: (id: number) => api.get(`/admin/orders/${id}`, { params: { _t: Date.now() } }),
  
  // Get order timeline/events
  getTimeline: (id: number) => api.get(`/admin/orders/${id}/timeline`, { params: { _t: Date.now() } }),
  
  // Update order status
  updateStatus: (id: number, data: { new_status: string; notes?: string; notify_customer?: boolean }) =>
    api.put(`/admin/orders/${id}/status`, data),
  
  // Add note to order
  addNote: (id: number, note: string) =>
    api.post(`/admin/orders/${id}/notes`, { note }),
  
  // Get SLA breached orders
  getBreachedSLA: () => api.get('/admin/orders-sla/breached'),
  
  // Get at-risk SLA orders
  getAtRiskSLA: () => api.get('/admin/orders-sla/at-risk'),
  
  // Get status options
  getStatusOptions: () => api.get('/admin/status-options'),
}

// Payments API (Phase 7)
export const paymentsAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    payment_method?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => api.get('/payments', { params }),
  
  getById: (id: number) => api.get(`/payments/${id}`),
  
  updateStatus: (id: number, data: { status: string; notes?: string }) =>
    api.patch(`/payments/${id}/status`, data),
}

// Invoices API (Phase 7)
export const invoicesAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    invoice_type?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => api.get('/invoices', { params }),
  
  getById: (id: number) => api.get(`/invoices/${id}`),
  
  generate: (order_id: number, notes?: string) =>
    api.post('/invoices/generate', { order_id, notes }),
  
  updateStatus: (id: number, data: { status: string }) =>
    api.patch(`/invoices/${id}/status`, data),
  
  getPdfData: (id: number) => api.get(`/invoices/${id}/pdf`),
}

// Credit Notes API (Phase 7)
export const creditNotesAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    reason_category?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => api.get('/credit-notes', { params }),
  
  getById: (id: number) => api.get(`/credit-notes/${id}`),
  
  create: (data: {
    invoice_id: number;
    reason: string;
    reason_category?: string;
    items?: any[];
    notes?: string;
    refund_method?: string;
  }) => api.post('/credit-notes', data),
  
  apply: (id: number, refund_transaction_id?: string) =>
    api.patch(`/credit-notes/${id}/apply`, { refund_transaction_id }),
  
  void: (id: number, reason?: string) =>
    api.patch(`/credit-notes/${id}/void`, { reason }),
  
  getPdfData: (id: number) => api.get(`/credit-notes/${id}/pdf`),
}

// Notifications API (Phase 7)
export const notificationsAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    notification_type?: string;
    channel?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => api.get('/notifications', { params }),
  
  getById: (id: number) => api.get(`/notifications/${id}`),
  
  send: (data: {
    user_id: number;
    notification_type?: string;
    channel?: string;
    subject?: string;
    message: string;
    related_type?: string;
    related_id?: number;
  }) => api.post('/notifications/send', data),
  
  sendBulk: (data: {
    user_ids: number[];
    notification_type?: string;
    channel?: string;
    subject?: string;
    message: string;
  }) => api.post('/notifications/send-bulk', data),
  
  getTemplates: () => api.get('/notifications/templates/list'),
  
  createTemplate: (data: {
    name: string;
    notification_type: string;
    channel: string;
    subject_template?: string;
    body_template: string;
    variables?: string[];
  }) => api.post('/notifications/templates', data),
  
  updateTemplate: (id: number, data: {
    name?: string;
    notification_type?: string;
    channel?: string;
    subject_template?: string;
    body_template?: string;
    variables?: string[];
    is_active?: boolean;
  }) => api.put(`/notifications/templates/${id}`, data),
  
  // DLQ (Dead Letter Queue) endpoints
  getDLQ: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    notification_type?: string;
    channel?: string;
  }) => api.get('/notifications/dlq/list', { params }),
  
  getDLQEntry: (id: number) => api.get(`/notifications/dlq/${id}`),
  
  retryDLQ: (id: number) => api.post(`/notifications/dlq/${id}/retry`),
  
  retryAllDLQ: (data?: { notification_type?: string; channel?: string }) =>
    api.post('/notifications/dlq/retry-all', data),
  
  deleteDLQ: (id: number) => api.delete(`/notifications/dlq/${id}`),
  
  markDLQFailed: (id: number, reason?: string) =>
    api.post(`/notifications/dlq/${id}/mark-failed`, { reason }),
}

// Templates API (Phase 8 - Version controlled)
export const templatesAPI = {
  getAll: (params?: {
    type?: string;
    channel?: string;
    is_active?: boolean;
  }) => api.get('/admin/templates', { params }),
  
  getById: (id: number) => api.get(`/admin/templates/${id}`),
  
  create: (data: {
    name: string;
    type: string;
    channel: string;
    subject_template?: string;
    body_template: string;
    variables?: string[];
    is_active?: boolean;
  }) => api.post('/admin/templates', data),
  
  update: (id: number, data: {
    name?: string;
    type?: string;
    channel?: string;
    subject_template?: string;
    body_template?: string;
    variables?: string[];
    is_active?: boolean;
    change_notes?: string;
    create_version?: boolean;
  }) => api.put(`/admin/templates/${id}`, data),
  
  delete: (id: number) => api.delete(`/admin/templates/${id}`),
  
  // Version management
  getVersion: (templateId: number, versionId: number) =>
    api.get(`/admin/templates/${templateId}/versions/${versionId}`),
  
  activateVersion: (templateId: number, versionId: number) =>
    api.post(`/admin/templates/${templateId}/versions/${versionId}/activate`),
  
  // Preview
  preview: (id: number, data: { sample_data?: Record<string, any>; version_id?: number }) =>
    api.post(`/admin/templates/${id}/preview`, data),
  
  // Variable suggestions
  getVariables: (type: string) => api.get(`/admin/templates/variables/${type}`),
}

// Event Rules API (Phase 8)
export const eventRulesAPI = {
  getAll: (params?: {
    event_type?: string;
    channel?: string;
    is_active?: boolean;
  }) => api.get('/admin/event-rules', { params }),
  
  getEventTypes: () => api.get('/admin/event-rules/types/available'),
  
  getById: (id: number) => api.get(`/admin/event-rules/${id}`),
  
  create: (data: {
    name: string;
    event_type: string;
    template_id: number;
    conditions?: any[];
    channel: string;
    priority?: number;
    delay_minutes?: number;
    is_active?: boolean;
  }) => api.post('/admin/event-rules', data),
  
  update: (id: number, data: {
    name?: string;
    event_type?: string;
    template_id?: number;
    conditions?: any[];
    channel?: string;
    priority?: number;
    delay_minutes?: number;
    is_active?: boolean;
  }) => api.put(`/admin/event-rules/${id}`, data),
  
  delete: (id: number) => api.delete(`/admin/event-rules/${id}`),
  
  toggle: (id: number) => api.patch(`/admin/event-rules/${id}/toggle`),
  
  test: (id: number, sample_data: Record<string, any>) =>
    api.post(`/admin/event-rules/${id}/test`, { sample_data }),
  
  trigger: (id: number, data: {
    user_id: number;
    data?: Record<string, any>;
    related_type?: string;
    related_id?: number;
  }) => api.post(`/admin/event-rules/${id}/trigger`, data),
}

// Campaigns API (Phase 8)
export const campaignsAPI = {
  getAll: (params?: {
    status?: string;
    campaign_type?: string;
    segment_type?: string;
  }) => api.get('/campaigns', { params }),
  
  getById: (id: number) => api.get(`/campaigns/${id}`),
  
  create: (data: {
    name: string;
    description?: string;
    campaign_type: string;
    template_id?: number;
    segment_type: string;
    segment_criteria?: any;
    channel: string;
    scheduled_at?: string;
    frequency_cap_hours?: number;
    requires_opt_in?: boolean;
  }) => api.post('/campaigns', data),
  
  update: (id: number, data: {
    name?: string;
    description?: string;
    campaign_type?: string;
    template_id?: number;
    segment_type?: string;
    segment_criteria?: any;
    channel?: string;
    scheduled_at?: string;
    frequency_cap_hours?: number;
    requires_opt_in?: boolean;
  }) => api.put(`/campaigns/${id}`, data),
  
  delete: (id: number) => api.delete(`/campaigns/${id}`),
  
  start: (id: number) => api.post(`/campaigns/${id}/start`),
  
  pause: (id: number) => api.post(`/campaigns/${id}/pause`),
  
  // Segments
  getSegments: () => api.get('/campaigns/segments/list'),
  
  createSegment: (data: {
    name: string;
    description?: string;
    segment_type: string;
    criteria?: any;
    is_dynamic?: boolean;
  }) => api.post('/campaigns/segments', data),
  
  // Category Rules
  getCategoryRules: (params?: { category_id?: number; is_active?: boolean }) =>
    api.get('/campaigns/category-rules/list', { params }),
  
  createCategoryRule: (data: {
    name: string;
    category_id: number;
    template_id: number;
    trigger_type: string;
    trigger_conditions?: any;
    channel: string;
    frequency_cap_hours?: number;
    is_active?: boolean;
    requires_opt_in?: boolean;
  }) => api.post('/campaigns/category-rules', data),
  
  updateCategoryRule: (id: number, data: {
    name?: string;
    category_id?: number;
    template_id?: number;
    trigger_type?: string;
    trigger_conditions?: any;
    channel?: string;
    frequency_cap_hours?: number;
    is_active?: boolean;
    requires_opt_in?: boolean;
  }) => api.put(`/campaigns/category-rules/${id}`, data),
  
  deleteCategoryRule: (id: number) => api.delete(`/campaigns/category-rules/${id}`),
  
  toggleCategoryRule: (id: number) => api.patch(`/campaigns/category-rules/${id}/toggle`),
}

// =============================================
// Phase 9: Reports, Audit & System Settings API
// =============================================

// Reports API
export const reportsAPI = {
  // Sales Report
  getSalesReport: (params?: { period?: string; start_date?: string; end_date?: string }) =>
    api.get('/reports/sales', { params }),

  // Tax Report
  getTaxReport: (params?: { period?: string; start_date?: string; end_date?: string }) =>
    api.get('/reports/tax', { params }),

  // Order Analytics
  getOrdersReport: (params?: { period?: string; start_date?: string; end_date?: string }) =>
    api.get('/reports/orders', { params }),

  // Customers Report
  getCustomersReport: (params?: { period?: string; start_date?: string; end_date?: string }) =>
    api.get('/reports/customers', { params }),

  // Inventory Report
  getInventoryReport: () => api.get('/reports/inventory'),

  // Export Report
  exportReport: (data: { report_type: string; format?: string; parameters?: any }) =>
    api.post('/reports/export', data),

  // Get Export History
  getExports: (params?: { page?: number; limit?: number }) =>
    api.get('/reports/exports', { params }),

  // Clear Cache
  clearCache: (report_type?: string) =>
    api.delete('/reports/cache', { params: { report_type } }),
}

// Audit Logs API
export const auditAPI = {
  // Get All Audit Logs
  getAll: (params?: {
    page?: number;
    limit?: number;
    action_type?: string;
    entity_type?: string;
    entity_id?: number;
    admin_id?: number;
    user_id?: number;
    severity?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => api.get('/audit', { params }),

  // Get Single Audit Log
  getById: (id: number) => api.get(`/audit/${id}`),

  // Get Statistics
  getStats: () => api.get('/audit/stats/summary'),

  // Get Action Types (for filtering)
  getActionTypes: () => api.get('/audit/filters/action-types'),

  // Get Entity Types (for filtering)
  getEntityTypes: () => api.get('/audit/filters/entity-types'),

  // Export Audit Logs
  export: (data: { start_date?: string; end_date?: string; format?: string }) =>
    api.post('/audit/export', data),

  // Create Audit Log (internal use)
  create: (data: {
    action_type: string;
    entity_type: string;
    entity_id?: number;
    user_id?: number;
    old_values?: any;
    new_values?: any;
    description?: string;
    severity?: string;
  }) => api.post('/audit', data),
}

// System Settings API
export const settingsAPI = {
  // Get All Settings
  getAll: (category?: string) =>
    api.get('/settings', { params: { category } }),

  // Get Categories
  getCategories: () => api.get('/settings/categories'),

  // Get Setting by Key
  getByKey: (key: string) => api.get(`/settings/key/${key}`),

  // Get Setting History
  getHistory: (id: number) => api.get(`/settings/${id}/history`),

  // Update Setting
  update: (id: number, data: { setting_value: any; change_reason?: string }) =>
    api.put(`/settings/${id}`, data),

  // Bulk Update Settings
  bulkUpdate: (data: { settings: Array<{ key: string; value: any }>; change_reason?: string }) =>
    api.put('/settings/bulk/update', data),

  // Create Setting
  create: (data: {
    setting_key: string;
    setting_value?: any;
    setting_type?: string;
    category?: string;
    description?: string;
    is_sensitive?: boolean;
  }) => api.post('/settings', data),

  // Delete Setting
  delete: (id: number) => api.delete(`/settings/${id}`),

  // Rollback Setting
  rollback: (id: number, version: number) =>
    api.post(`/settings/${id}/rollback`, { version }),

  // Get Public Settings (no auth required)
  getPublic: () => api.get('/settings/public/app'),
}

// Feature Toggles API
export const featureTogglesAPI = {
  // Get All Feature Toggles
  getAll: (params?: { category?: string; is_enabled?: boolean }) =>
    api.get('/features', { params }),

  // Get Categories
  getCategories: () => api.get('/features/categories'),

  // Get Single Feature Toggle
  getById: (id: number) => api.get(`/features/${id}`),

  // Toggle Feature On/Off
  toggle: (id: number, change_reason?: string) =>
    api.put(`/features/${id}/toggle`, { change_reason }),

  // Update Feature Toggle
  update: (id: number, data: {
    feature_name?: string;
    description?: string;
    category?: string;
    is_kill_switch?: boolean;
    rollout_percentage?: number;
    dependencies?: string[];
    enabled_for_users?: number[];
    disabled_for_users?: number[];
  }) => api.put(`/features/${id}`, data),

  // Create Feature Toggle
  create: (data: {
    feature_key: string;
    feature_name: string;
    description?: string;
    is_enabled?: boolean;
    is_kill_switch?: boolean;
    category?: string;
    rollout_percentage?: number;
    dependencies?: string[];
  }) => api.post('/features', data),

  // Delete Feature Toggle
  delete: (id: number) => api.delete(`/features/${id}`),

  // Activate Kill-Switch for Category
  killSwitch: (category: string, change_reason?: string) =>
    api.post(`/features/kill-switch/${category}`, { change_reason }),

  // Check Features (public - for mobile app)
  checkAll: (user_id?: number) =>
    api.get('/features/public/check', { params: { user_id } }),

  // Check Single Feature (public)
  check: (feature_key: string, user_id?: number) =>
    api.get(`/features/public/check/${feature_key}`, { params: { user_id } }),
}

// =============================================
// AI Features API
// =============================================
export const aiAPI = {
  // Description Generation
  generateDescription: (data: { prompt: string; productId?: number }) =>
    api.post('/ai/generate/description', data),

  // Image Prompt Generation
  generateImagePrompt: (data: { prompt: string; productId?: number }) =>
    api.post('/ai/generate/image', data),

  // Get Pending Approvals
  getPendingApprovals: (params?: { page?: number; limit?: number }) =>
    api.get('/ai/approvals/pending', { params }),

  // Get All Generations
  getGenerations: (params?: { page?: number; limit?: number; status?: string; type?: string }) =>
    api.get('/ai/generations', { params }),

  // Approve Generation
  approve: (id: number, notes?: string) =>
    api.post(`/ai/approvals/${id}/approve`, { notes }),

  // Reject Generation
  reject: (id: number, reason: string) =>
    api.post(`/ai/approvals/${id}/reject`, { reason }),

  // Get My Quota
  getMyQuota: () => api.get('/ai/quota/me'),

  // Get Usage Statistics (Super Admin)
  getUsageStats: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/ai/usage/stats', { params }),

  // Get AI Settings (Super Admin)
  getSettings: () => api.get('/ai/settings'),

  // Update AI Settings (Super Admin)
  updateSettings: (data: {
    gemini_api_key?: string;
    daily_quota_per_user?: number;
    image_generation_enabled?: boolean;
    description_generation_enabled?: boolean;
    auto_approval_enabled?: boolean;
    cost_per_image_usd?: number;
    cost_per_1k_tokens_usd?: number;
  }) => api.put('/ai/settings', data),

  // Initialize AI Service (Super Admin)
  initialize: () => api.post('/ai/initialize'),
}