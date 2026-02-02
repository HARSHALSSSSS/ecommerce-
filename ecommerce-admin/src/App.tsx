import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductManagement from './pages/ProductManagement'
import Categories from './pages/Categories'
import Inventory from './pages/Inventory'
import Orders from './pages/Orders'
import Shipments from './pages/Shipments'
import Returns from './pages/Returns'
import Refunds from './pages/Refunds'
import Replacements from './pages/Replacements'
import Tickets from './pages/Tickets'
import Users from './pages/Users'
import Stores from './pages/Stores'
import Settings from './pages/Settings'
import Roles from './pages/Roles'
import AdminUsers from './pages/AdminUsers'
import Sessions from './pages/Sessions'
import ActivityLogs from './pages/ActivityLogs'
import Payments from './pages/Payments'
import Invoices from './pages/Invoices'
import Notifications from './pages/Notifications'
import NotificationTemplates from './pages/NotificationTemplates'
import EventRules from './pages/EventRules'
import Campaigns from './pages/Campaigns'
import Reports from './pages/Reports'
import AuditLogs from './pages/AuditLogs'
import StoreSettings from './pages/StoreSettings'
import FeatureToggles from './pages/FeatureToggles'
import AIImageGenerator from './pages/AIImageGenerator'
import AIDescriptionGenerator from './pages/AIDescriptionGenerator'
import AIApprovalQueue from './pages/AIApprovalQueue'
import AIUsageDashboard from './pages/AIUsageDashboard'
import Layout from './components/Layout'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="categories" element={<Categories />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="orders" element={<Orders />} />
            <Route path="shipments" element={<Shipments />} />
            <Route path="returns" element={<Returns />} />
            <Route path="refunds" element={<Refunds />} />
            <Route path="replacements" element={<Replacements />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="payments" element={<Payments />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="notification-templates" element={<NotificationTemplates />} />
            <Route path="event-rules" element={<EventRules />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="users" element={<Users />} />
            <Route path="stores" element={<Stores />} />
            <Route path="roles" element={<Roles />} />
            <Route path="admin-users" element={<AdminUsers />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="activity-logs" element={<ActivityLogs />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="feature-toggles" element={<FeatureToggles />} />
            <Route path="ai/image-generator" element={<AIImageGenerator />} />
            <Route path="ai/description-generator" element={<AIDescriptionGenerator />} />
            <Route path="ai/approval-queue" element={<AIApprovalQueue />} />
            <Route path="ai/usage-dashboard" element={<AIUsageDashboard />} />
            <Route path="settings" element={<StoreSettings />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
