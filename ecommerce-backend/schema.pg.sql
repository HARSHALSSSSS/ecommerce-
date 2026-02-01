-- PostgreSQL schema for ecommerce-backend

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  is_active INTEGER DEFAULT 1,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  postal_code TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DOUBLE PRECISION NOT NULL,
  discount_percent INTEGER DEFAULT 0,
  category_id INTEGER,
  category TEXT,
  rating DOUBLE PRECISION DEFAULT 0,
  image_url TEXT,
  store_id INTEGER,
  is_collection INTEGER DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  sku TEXT UNIQUE,
  is_active INTEGER DEFAULT 1,
  is_visible INTEGER DEFAULT 1,
  low_stock_threshold INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  version INTEGER DEFAULT 1,
  last_stock_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id INTEGER,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  product_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product versions
CREATE TABLE IF NOT EXISTS product_versions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  changes TEXT NOT NULL,
  changed_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory logs
CREATE TABLE IF NOT EXISTS inventory_logs (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  change_quantity INTEGER NOT NULL,
  change_type TEXT NOT NULL,
  reason TEXT,
  changed_by INTEGER,
  order_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Low stock alerts
CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL,
  current_stock INTEGER NOT NULL,
  threshold INTEGER NOT NULL,
  is_resolved INTEGER DEFAULT 0,
  resolved_at TIMESTAMP,
  resolved_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stores table
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  rating DOUBLE PRECISION DEFAULT 0,
  followers INTEGER DEFAULT 0,
  order_processed TEXT DEFAULT '2 Hours',
  image_url TEXT,
  description TEXT,
  owner_id INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cart table
CREATE TABLE IF NOT EXISTS cart (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  size TEXT,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wishlist table
CREATE TABLE IF NOT EXISTS wishlist (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, user_id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  total_amount DOUBLE PRECISION NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  delivery_address TEXT,
  city TEXT,
  postal_code TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price DOUBLE PRECISION NOT NULL
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin activity logs
CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id INTEGER,
  changes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Events
CREATE TABLE IF NOT EXISTS order_events (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  actor_type TEXT NOT NULL,
  actor_id INTEGER,
  actor_name TEXT,
  notes TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order SLA
CREATE TABLE IF NOT EXISTS order_sla (
  id SERIAL PRIMARY KEY,
  order_id INTEGER UNIQUE NOT NULL,
  status TEXT NOT NULL,
  sla_deadline TIMESTAMP NOT NULL,
  is_breached INTEGER DEFAULT 0,
  breached_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(module, action)
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, permission_id)
);

-- Admin-Role mapping
CREATE TABLE IF NOT EXISTS admin_roles (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  assigned_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(admin_id, role_id)
);

-- Admin Sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_info TEXT,
  location TEXT,
  is_active INTEGER DEFAULT 1,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Login attempts
CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  success INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User blocks table
CREATE TABLE IF NOT EXISTS user_blocks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  blocked_by INTEGER NOT NULL,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unblocked_at TIMESTAMP,
  unblocked_by INTEGER,
  unblock_reason TEXT,
  is_active INTEGER DEFAULT 1
);

-- User activity logs
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  action_type TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_info TEXT,
  location TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL,
  email_marketing INTEGER DEFAULT 1,
  email_orders INTEGER DEFAULT 1,
  email_promotions INTEGER DEFAULT 1,
  push_enabled INTEGER DEFAULT 1,
  push_orders INTEGER DEFAULT 1,
  push_promotions INTEGER DEFAULT 1,
  sms_enabled INTEGER DEFAULT 0,
  sms_orders INTEGER DEFAULT 0,
  consent_date TIMESTAMP,
  consent_source TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  shipment_number TEXT UNIQUE NOT NULL,
  courier_id TEXT NOT NULL,
  courier_name TEXT NOT NULL,
  tracking_number TEXT,
  tracking_url TEXT,
  status TEXT DEFAULT 'pending',
  weight DOUBLE PRECISION,
  dimensions TEXT,
  shipping_cost DOUBLE PRECISION DEFAULT 0,
  estimated_delivery DATE,
  actual_delivery TIMESTAMP,
  pickup_address TEXT,
  pickup_scheduled TIMESTAMP,
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipment events
CREATE TABLE IF NOT EXISTS shipment_events (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  location TEXT,
  description TEXT,
  event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'manual',
  raw_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Return requests
CREATE TABLE IF NOT EXISTS return_requests (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  return_number TEXT UNIQUE NOT NULL,
  reason_code TEXT NOT NULL,
  reason_text TEXT,
  status TEXT DEFAULT 'pending',
  requested_action TEXT DEFAULT 'refund',
  items TEXT NOT NULL,
  images TEXT,
  pickup_address TEXT,
  pickup_scheduled TIMESTAMP,
  pickup_completed TIMESTAMP,
  admin_notes TEXT,
  processed_by INTEGER,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Return events
CREATE TABLE IF NOT EXISTS return_events (
  id SERIAL PRIMARY KEY,
  return_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  actor_type TEXT NOT NULL,
  actor_id INTEGER,
  actor_name TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  return_id INTEGER,
  refund_number TEXT UNIQUE NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'USD',
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_mode TEXT NOT NULL,
  original_payment_method TEXT,
  transaction_id TEXT,
  bank_reference TEXT,
  initiated_by INTEGER,
  processed_by INTEGER,
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,
  failure_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Replacement orders
CREATE TABLE IF NOT EXISTS replacement_orders (
  id SERIAL PRIMARY KEY,
  original_order_id INTEGER NOT NULL,
  replacement_order_id INTEGER,
  return_id INTEGER,
  replacement_number TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  items TEXT NOT NULL,
  shipping_address TEXT,
  notes TEXT,
  approved_by INTEGER,
  approved_at TIMESTAMP,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courier configuration
CREATE TABLE IF NOT EXISTS couriers (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  tracking_url_template TEXT,
  api_enabled INTEGER DEFAULT 0,
  api_key TEXT,
  api_endpoint TEXT,
  is_active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  ticket_number TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  sla_hours INTEGER DEFAULT 24,
  sla_due_at TIMESTAMP,
  sla_breached INTEGER DEFAULT 0,
  assigned_to INTEGER,
  assigned_at TIMESTAMP,
  first_response_at TIMESTAMP,
  last_response_at TIMESTAMP,
  resolution_summary TEXT,
  closed_at TIMESTAMP,
  closed_by INTEGER,
  satisfaction_rating INTEGER,
  satisfaction_feedback TEXT,
  escalation_level INTEGER DEFAULT 0,
  tags TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket messages
CREATE TABLE IF NOT EXISTS ticket_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id INTEGER NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  is_internal INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  message_id INTEGER,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by_type TEXT NOT NULL,
  uploaded_by_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket escalations
CREATE TABLE IF NOT EXISTS ticket_escalations (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  previous_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  escalated_by INTEGER NOT NULL,
  escalated_by_type TEXT NOT NULL,
  escalated_to INTEGER,
  reason TEXT NOT NULL,
  notes TEXT,
  auto_escalated INTEGER DEFAULT 0,
  resolved_at TIMESTAMP,
  resolved_by INTEGER,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket activities
CREATE TABLE IF NOT EXISTS ticket_activities (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  actor_name TEXT,
  old_value TEXT,
  new_value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  payment_provider TEXT,
  transaction_id TEXT UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_type TEXT DEFAULT 'order',
  gateway_response TEXT,
  failure_reason TEXT,
  metadata TEXT,
  ip_address TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  payment_id INTEGER,
  invoice_type TEXT DEFAULT 'sale',
  subtotal DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  shipping_amount DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'issued',
  billing_name TEXT,
  billing_address TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_postal_code TEXT,
  billing_country TEXT,
  notes TEXT,
  pdf_url TEXT,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  due_at TIMESTAMP,
  paid_at TIMESTAMP,
  voided_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit notes table
CREATE TABLE IF NOT EXISTS credit_notes (
  id SERIAL PRIMARY KEY,
  credit_note_number TEXT UNIQUE NOT NULL,
  invoice_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reason_category TEXT,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'issued',
  refund_method TEXT,
  refund_transaction_id TEXT,
  notes TEXT,
  pdf_url TEXT,
  issued_by INTEGER,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit note items table
CREATE TABLE IF NOT EXISTS credit_note_items (
  id SERIAL PRIMARY KEY,
  credit_note_id INTEGER NOT NULL,
  invoice_item_id INTEGER,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification logs table
CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  admin_id INTEGER,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  related_type TEXT,
  related_id INTEGER,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  failed_reason TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject_template TEXT,
  body_template TEXT NOT NULL,
  variables TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification template versions
CREATE TABLE IF NOT EXISTS notification_template_versions (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  subject_template TEXT,
  body_template TEXT NOT NULL,
  variables TEXT,
  change_notes TEXT,
  created_by INTEGER,
  is_active INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_id, version)
);

-- Event trigger rules
CREATE TABLE IF NOT EXISTS event_trigger_rules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  template_id INTEGER NOT NULL,
  conditions TEXT,
  channel TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  delay_minutes INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification dead letter queue
CREATE TABLE IF NOT EXISTS notification_dlq (
  id SERIAL PRIMARY KEY,
  original_notification_id INTEGER,
  user_id INTEGER,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  related_type TEXT,
  related_id INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP,
  status TEXT DEFAULT 'pending',
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marketing campaigns
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL,
  template_id INTEGER,
  segment_type TEXT NOT NULL,
  segment_criteria TEXT,
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  frequency_cap_hours INTEGER DEFAULT 24,
  requires_opt_in INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaign segments
CREATE TABLE IF NOT EXISTS campaign_segments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  segment_type TEXT NOT NULL,
  criteria TEXT NOT NULL,
  user_count INTEGER DEFAULT 0,
  is_dynamic INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaign logs
CREATE TABLE IF NOT EXISTS campaign_logs (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  notification_id INTEGER,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Category marketing rules
CREATE TABLE IF NOT EXISTS category_marketing_rules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_conditions TEXT,
  channel TEXT NOT NULL,
  frequency_cap_hours INTEGER DEFAULT 24,
  is_active INTEGER DEFAULT 1,
  requires_opt_in INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User marketing preferences
CREATE TABLE IF NOT EXISTS user_marketing_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  email_marketing INTEGER DEFAULT 0,
  push_marketing INTEGER DEFAULT 0,
  sms_marketing INTEGER DEFAULT 0,
  category_preferences TEXT,
  last_campaign_sent_at TIMESTAMP,
  opt_in_date TIMESTAMP,
  opt_out_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Push notification tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  device_type TEXT DEFAULT 'mobile',
  device_name TEXT,
  is_active INTEGER DEFAULT 1,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, token)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  admin_id INTEGER,
  user_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  old_values TEXT,
  new_values TEXT,
  description TEXT,
  severity TEXT DEFAULT 'info',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type TEXT DEFAULT 'string',
  category TEXT DEFAULT 'general',
  description TEXT,
  is_sensitive INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  updated_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings History
CREATE TABLE IF NOT EXISTS settings_history (
  id SERIAL PRIMARY KEY,
  setting_id INTEGER NOT NULL,
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  version INTEGER NOT NULL,
  changed_by INTEGER,
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feature Toggles
CREATE TABLE IF NOT EXISTS feature_toggles (
  id SERIAL PRIMARY KEY,
  feature_key TEXT UNIQUE NOT NULL,
  feature_name TEXT NOT NULL,
  description TEXT,
  is_enabled INTEGER DEFAULT 1,
  is_kill_switch INTEGER DEFAULT 0,
  category TEXT DEFAULT 'general',
  dependencies TEXT,
  rollout_percentage INTEGER DEFAULT 100,
  enabled_for_users TEXT,
  disabled_for_users TEXT,
  updated_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feature Toggle History
CREATE TABLE IF NOT EXISTS feature_toggle_history (
  id SERIAL PRIMARY KEY,
  feature_id INTEGER NOT NULL,
  feature_key TEXT NOT NULL,
  action TEXT NOT NULL,
  old_state INTEGER,
  new_state INTEGER,
  changed_by INTEGER,
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Report Cache
CREATE TABLE IF NOT EXISTS report_cache (
  id SERIAL PRIMARY KEY,
  report_type TEXT NOT NULL,
  report_key TEXT NOT NULL,
  report_data TEXT NOT NULL,
  parameters TEXT,
  expires_at TIMESTAMP NOT NULL,
  generated_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(report_type, report_key)
);

-- Report Exports
CREATE TABLE IF NOT EXISTS report_exports (
  id SERIAL PRIMARY KEY,
  report_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_size INTEGER,
  format TEXT NOT NULL,
  parameters TEXT,
  status TEXT DEFAULT 'pending',
  downloaded_at TIMESTAMP,
  exported_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_visible ON products(is_visible);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
