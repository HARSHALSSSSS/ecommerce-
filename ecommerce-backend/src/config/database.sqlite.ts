import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database | null = null;

export async function initializeDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  const dataDir = path.join(process.cwd(), 'data');
  
  // Create data directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'ecommerce.db');

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON');

  // Create tables
  await createTables();

  console.log('✅ Database initialized successfully');
  return db;
}

export async function createTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  // Admins table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      city TEXT,
      country TEXT,
      postal_code TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      discount_percent INTEGER DEFAULT 0,
      category_id INTEGER,
      category TEXT,
      rating REAL DEFAULT 0,
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
      last_stock_update DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(store_id) REFERENCES stores(id),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    )
  `);

  // Categories table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      image_url TEXT,
      parent_id INTEGER,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      product_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(parent_id) REFERENCES categories(id)
    )
  `);

  // Product versions for version-controlled updates
  await db.exec(`
    CREATE TABLE IF NOT EXISTS product_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      changes TEXT NOT NULL,
      changed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(changed_by) REFERENCES admins(id)
    )
  `);

  // Inventory logs for stock changes
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      previous_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      change_quantity INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      reason TEXT,
      changed_by INTEGER,
      order_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(changed_by) REFERENCES admins(id),
      FOREIGN KEY(order_id) REFERENCES orders(id)
    )
  `);

  // Low stock alerts
  await db.exec(`
    CREATE TABLE IF NOT EXISTS low_stock_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      alert_type TEXT NOT NULL,
      current_stock INTEGER NOT NULL,
      threshold INTEGER NOT NULL,
      is_resolved INTEGER DEFAULT 0,
      resolved_at DATETIME,
      resolved_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(resolved_by) REFERENCES admins(id)
    )
  `);

  // Stores table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      rating REAL DEFAULT 0,
      followers INTEGER DEFAULT 0,
      order_processed TEXT DEFAULT '2 Hours',
      image_url TEXT,
      description TEXT,
      owner_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id)
    )
  `);

  // Cart table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      size TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Wishlist table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(product_id, user_id)
    )
  `);

  // Orders table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      delivery_address TEXT,
      city TEXT,
      postal_code TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Order Items table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  // Password reset tokens
  await db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      is_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Admin activity logs
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id INTEGER,
      changes TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(admin_id) REFERENCES admins(id)
    )
  `);

  // Activity logs table for general activity tracking
  await db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Order Events table for immutable timeline/audit trail
  await db.exec(`
    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      actor_type TEXT NOT NULL,
      actor_id INTEGER,
      actor_name TEXT,
      notes TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    )
  `);

  // Order SLA tracking table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS order_sla (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      status TEXT NOT NULL,
      sla_deadline DATETIME NOT NULL,
      is_breached INTEGER DEFAULT 0,
      breached_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    )
  `);

  // Roles table for RBAC
  await db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      is_system INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Permissions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(module, action)
    )
  `);

  // Role-Permission mapping
  await db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE(role_id, permission_id)
    )
  `);

  // Admin-Role mapping (an admin can have multiple roles)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      assigned_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE CASCADE,
      FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY(assigned_by) REFERENCES admins(id),
      UNIQUE(admin_id, role_id)
    )
  `);

  // Admin Sessions for session management
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      device_info TEXT,
      location TEXT,
      is_active INTEGER DEFAULT 1,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE CASCADE
    )
  `);

  // Login attempts for rate limiting
  await db.exec(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      ip_address TEXT,
      success INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User blocks table for blocking/unblocking users
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      blocked_by INTEGER NOT NULL,
      reason TEXT NOT NULL,
      blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      unblocked_at DATETIME,
      unblocked_by INTEGER,
      unblock_reason TEXT,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(blocked_by) REFERENCES admins(id),
      FOREIGN KEY(unblocked_by) REFERENCES admins(id)
    )
  `);

  // User activity logs for tracking user actions
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      action_type TEXT,
      ip_address TEXT,
      user_agent TEXT,
      device_info TEXT,
      location TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // User notification preferences
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      email_marketing INTEGER DEFAULT 1,
      email_orders INTEGER DEFAULT 1,
      email_promotions INTEGER DEFAULT 1,
      push_enabled INTEGER DEFAULT 1,
      push_orders INTEGER DEFAULT 1,
      push_promotions INTEGER DEFAULT 1,
      sms_enabled INTEGER DEFAULT 0,
      sms_orders INTEGER DEFAULT 0,
      consent_date DATETIME,
      consent_source TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // NOTE: Old support_tickets and ticket_messages tables removed
  // Replaced with more comprehensive tickets system in Phase 6 below

  // Shipments table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      shipment_number TEXT UNIQUE NOT NULL,
      courier_id TEXT NOT NULL,
      courier_name TEXT NOT NULL,
      tracking_number TEXT,
      tracking_url TEXT,
      status TEXT DEFAULT 'pending',
      weight REAL,
      dimensions TEXT,
      shipping_cost REAL DEFAULT 0,
      estimated_delivery DATE,
      actual_delivery DATETIME,
      pickup_address TEXT,
      pickup_scheduled DATETIME,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(created_by) REFERENCES admins(id)
    )
  `);

  // Shipment events/tracking timeline
  await db.exec(`
    CREATE TABLE IF NOT EXISTS shipment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      location TEXT,
      description TEXT,
      event_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      source TEXT DEFAULT 'manual',
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
    )
  `);

  // Return requests table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS return_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      pickup_scheduled DATETIME,
      pickup_completed DATETIME,
      admin_notes TEXT,
      processed_by INTEGER,
      processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(processed_by) REFERENCES admins(id)
    )
  `);

  // Return events timeline
  await db.exec(`
    CREATE TABLE IF NOT EXISTS return_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      actor_type TEXT NOT NULL,
      actor_id INTEGER,
      actor_name TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(return_id) REFERENCES return_requests(id) ON DELETE CASCADE
    )
  `);

  // Refunds table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      return_id INTEGER,
      refund_number TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_mode TEXT NOT NULL,
      original_payment_method TEXT,
      transaction_id TEXT,
      bank_reference TEXT,
      processed_by INTEGER,
      processed_at DATETIME,
      completed_at DATETIME,
      failure_reason TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(return_id) REFERENCES return_requests(id),
      FOREIGN KEY(processed_by) REFERENCES admins(id)
    )
  `);

  // Replacement orders table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS replacement_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      approved_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(original_order_id) REFERENCES orders(id),
      FOREIGN KEY(replacement_order_id) REFERENCES orders(id),
      FOREIGN KEY(return_id) REFERENCES return_requests(id),
      FOREIGN KEY(approved_by) REFERENCES admins(id),
      FOREIGN KEY(created_by) REFERENCES admins(id)
    )
  `);

  // Courier configuration table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS couriers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      logo_url TEXT,
      tracking_url_template TEXT,
      api_enabled INTEGER DEFAULT 0,
      api_key TEXT,
      api_endpoint TEXT,
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for better query performance
  await db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_logs_type ON inventory_logs(change_type);
    CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_product ON low_stock_alerts(product_id);
    CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_resolved ON low_stock_alerts(is_resolved);
    CREATE INDEX IF NOT EXISTS idx_product_versions_product ON product_versions(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions(is_active);
    CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
    CREATE INDEX IF NOT EXISTS idx_admin_roles_admin ON admin_roles(admin_id);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
    CREATE INDEX IF NOT EXISTS idx_user_blocks_user ON user_blocks(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_blocks_active ON user_blocks(is_active);
    CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user ON user_activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON user_activity_logs(action);
    CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
    CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
    CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
    CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON shipment_events(shipment_id);
    CREATE INDEX IF NOT EXISTS idx_return_requests_order ON return_requests(order_id);
    CREATE INDEX IF NOT EXISTS idx_return_requests_user ON return_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);
    CREATE INDEX IF NOT EXISTS idx_return_events_return ON return_events(return_id);
    CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
    CREATE INDEX IF NOT EXISTS idx_refunds_return ON refunds(return_id);
    CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
    CREATE INDEX IF NOT EXISTS idx_replacement_orders_original ON replacement_orders(original_order_id);
    CREATE INDEX IF NOT EXISTS idx_replacement_orders_replacement ON replacement_orders(replacement_order_id);
    CREATE INDEX IF NOT EXISTS idx_couriers_code ON couriers(code);
  `);

  // ============================================
  // PHASE 6: GRIEVANCE / TICKET MANAGEMENT
  // ============================================

  // Support tickets table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      sla_hours INTEGER DEFAULT 24,
      sla_due_at DATETIME,
      sla_breached INTEGER DEFAULT 0,
      assigned_to INTEGER,
      assigned_at DATETIME,
      first_response_at DATETIME,
      last_response_at DATETIME,
      resolution_summary TEXT,
      closed_at DATETIME,
      closed_by INTEGER,
      satisfaction_rating INTEGER,
      satisfaction_feedback TEXT,
      escalation_level INTEGER DEFAULT 0,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(assigned_to) REFERENCES admins(id),
      FOREIGN KEY(closed_by) REFERENCES admins(id)
    )
  `);

  // Ticket messages / conversation thread
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      sender_name TEXT,
      message TEXT NOT NULL,
      is_internal INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    )
  `);

  // Ticket attachments
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      message_id INTEGER,
      filename TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      uploaded_by_type TEXT NOT NULL,
      uploaded_by_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY(message_id) REFERENCES ticket_messages(id) ON DELETE SET NULL
    )
  `);

  // Ticket escalations
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_escalations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      previous_level INTEGER NOT NULL,
      new_level INTEGER NOT NULL,
      escalated_by INTEGER NOT NULL,
      escalated_by_type TEXT NOT NULL,
      escalated_to INTEGER,
      reason TEXT NOT NULL,
      notes TEXT,
      auto_escalated INTEGER DEFAULT 0,
      resolved_at DATETIME,
      resolved_by INTEGER,
      resolution_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY(escalated_by) REFERENCES admins(id),
      FOREIGN KEY(escalated_to) REFERENCES admins(id),
      FOREIGN KEY(resolved_by) REFERENCES admins(id)
    )
  `);

  // Ticket activity log / audit trail
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id INTEGER NOT NULL,
      actor_name TEXT,
      old_value TEXT,
      new_value TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    )
  `);

  // Indexes for ticket tables
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(order_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tickets_sla_due ON tickets(sla_due_at);
    CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
    CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_escalations_ticket ON ticket_escalations(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket ON ticket_activities(ticket_id);
  `);

  // =============================================
  // PHASE 7: Payment, Invoice & Status Communication
  // =============================================

  // Payments table - Transaction logs (PCI-compliant, no sensitive card data)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Invoices table - Immutable invoice records
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      due_at DATETIME,
      paid_at DATETIME,
      voided_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(payment_id) REFERENCES payments(id) ON DELETE SET NULL
    )
  `);

  // Invoice items table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  // Credit notes table - Refund and adjustment invoices
  await db.exec(`
    CREATE TABLE IF NOT EXISTS credit_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      applied_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(issued_by) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Credit note items table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS credit_note_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credit_note_id INTEGER NOT NULL,
      invoice_item_id INTEGER,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      product_sku TEXT,
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      tax_amount DECIMAL(10, 2) DEFAULT 0,
      total_amount DECIMAL(10, 2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE,
      FOREIGN KEY(invoice_item_id) REFERENCES invoice_items(id) ON DELETE SET NULL,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  // Notification logs table - Status notifications and communications
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      sent_at DATETIME,
      delivered_at DATETIME,
      read_at DATETIME,
      failed_reason TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Notification templates table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notification_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      notification_type TEXT NOT NULL,
      channel TEXT NOT NULL,
      subject_template TEXT,
      body_template TEXT NOT NULL,
      variables TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User notification preferences table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      order_updates INTEGER DEFAULT 1,
      shipping_updates INTEGER DEFAULT 1,
      payment_updates INTEGER DEFAULT 1,
      promotional INTEGER DEFAULT 1,
      email_enabled INTEGER DEFAULT 1,
      push_enabled INTEGER DEFAULT 1,
      sms_enabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Indexes for Phase 7 tables
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_credit_notes_order ON credit_notes(order_id);
    CREATE INDEX IF NOT EXISTS idx_credit_notes_user ON credit_notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_credit_note_items_note ON credit_note_items(credit_note_id);
    CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON notification_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
    CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
    CREATE INDEX IF NOT EXISTS idx_notification_logs_related ON notification_logs(related_type, related_id);
  `);

  // ==================== PHASE 8: NOTIFICATION, EMAIL & MARKETING ====================

  // Notification template versions - Version controlled templates
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notification_template_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      subject_template TEXT,
      body_template TEXT NOT NULL,
      variables TEXT,
      change_notes TEXT,
      created_by INTEGER,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(template_id) REFERENCES notification_templates(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES admins(id) ON DELETE SET NULL,
      UNIQUE(template_id, version)
    )
  `);

  // Event trigger rules - Event-to-template mapping
  await db.exec(`
    CREATE TABLE IF NOT EXISTS event_trigger_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      template_id INTEGER NOT NULL,
      conditions TEXT,
      channel TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      delay_minutes INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(template_id) REFERENCES notification_templates(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Notification dead letter queue - Failed notifications for retry
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notification_dlq (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      next_retry_at DATETIME,
      status TEXT DEFAULT 'pending',
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(original_notification_id) REFERENCES notification_logs(id) ON DELETE SET NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Marketing campaigns - User-based marketing
  await db.exec(`
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      campaign_type TEXT NOT NULL,
      template_id INTEGER,
      segment_type TEXT NOT NULL,
      segment_criteria TEXT,
      channel TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      scheduled_at DATETIME,
      started_at DATETIME,
      completed_at DATETIME,
      total_recipients INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      opened_count INTEGER DEFAULT 0,
      clicked_count INTEGER DEFAULT 0,
      frequency_cap_hours INTEGER DEFAULT 24,
      requires_opt_in INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(template_id) REFERENCES notification_templates(id) ON DELETE SET NULL,
      FOREIGN KEY(created_by) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Campaign segments - User segments for targeting
  await db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      segment_type TEXT NOT NULL,
      criteria TEXT NOT NULL,
      user_count INTEGER DEFAULT 0,
      is_dynamic INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Campaign logs - Track campaign sends
  await db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      notification_id INTEGER,
      status TEXT DEFAULT 'pending',
      sent_at DATETIME,
      delivered_at DATETIME,
      opened_at DATETIME,
      clicked_at DATETIME,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(notification_id) REFERENCES notification_logs(id) ON DELETE SET NULL
    )
  `);

  // Category marketing rules - Category-level triggers
  await db.exec(`
    CREATE TABLE IF NOT EXISTS category_marketing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY(template_id) REFERENCES notification_templates(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // User marketing preferences - Marketing opt-in tracking
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_marketing_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      email_marketing INTEGER DEFAULT 0,
      push_marketing INTEGER DEFAULT 0,
      sms_marketing INTEGER DEFAULT 0,
      category_preferences TEXT,
      last_campaign_sent_at DATETIME,
      opt_in_date DATETIME,
      opt_out_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Indexes for Phase 8 tables
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_template_versions_template ON notification_template_versions(template_id);
    CREATE INDEX IF NOT EXISTS idx_template_versions_active ON notification_template_versions(is_active);
    CREATE INDEX IF NOT EXISTS idx_event_rules_event ON event_trigger_rules(event_type);
    CREATE INDEX IF NOT EXISTS idx_event_rules_template ON event_trigger_rules(template_id);
    CREATE INDEX IF NOT EXISTS idx_event_rules_active ON event_trigger_rules(is_active);
    CREATE INDEX IF NOT EXISTS idx_dlq_status ON notification_dlq(status);
    CREATE INDEX IF NOT EXISTS idx_dlq_next_retry ON notification_dlq(next_retry_at);
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON marketing_campaigns(status);
    CREATE INDEX IF NOT EXISTS idx_campaigns_type ON marketing_campaigns(campaign_type);
    CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign ON campaign_logs(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_logs_user ON campaign_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_category_rules_category ON category_marketing_rules(category_id);
    CREATE INDEX IF NOT EXISTS idx_category_rules_active ON category_marketing_rules(is_active);
    CREATE INDEX IF NOT EXISTS idx_user_marketing_prefs ON user_marketing_preferences(user_id);
  `);

  // Push notification tokens - Store user device tokens
  await db.exec(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      device_type TEXT DEFAULT 'mobile',
      device_name TEXT,
      is_active INTEGER DEFAULT 1,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, token)
    )
  `);

  // Index for push tokens
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active);
  `);

  // =============================================
  // Phase 9: Reports, Audit & System Settings
  // =============================================

  // Audit Logs - WORM-compliant system-wide action logs
  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE SET NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // System Settings - Version-controlled configuration
  await db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT,
      setting_type TEXT DEFAULT 'string',
      category TEXT DEFAULT 'general',
      description TEXT,
      is_sensitive INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      updated_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(updated_by) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Settings History - Version control for settings changes
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_id INTEGER NOT NULL,
      setting_key TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      version INTEGER NOT NULL,
      changed_by INTEGER,
      change_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(setting_id) REFERENCES system_settings(id) ON DELETE CASCADE,
      FOREIGN KEY(changed_by) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Feature Toggles - Application module control with kill-switch support
  await db.exec(`
    CREATE TABLE IF NOT EXISTS feature_toggles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(updated_by) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Feature Toggle History - Track toggle changes
  await db.exec(`
    CREATE TABLE IF NOT EXISTS feature_toggle_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature_id INTEGER NOT NULL,
      feature_key TEXT NOT NULL,
      action TEXT NOT NULL,
      old_state INTEGER,
      new_state INTEGER,
      changed_by INTEGER,
      change_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(feature_id) REFERENCES feature_toggles(id) ON DELETE CASCADE,
      FOREIGN KEY(changed_by) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Report Cache - Cached report data for performance
  await db.exec(`
    CREATE TABLE IF NOT EXISTS report_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_type TEXT NOT NULL,
      report_key TEXT NOT NULL,
      report_data TEXT NOT NULL,
      parameters TEXT,
      expires_at DATETIME NOT NULL,
      generated_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(report_type, report_key),
      FOREIGN KEY(generated_by) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Report Exports - Track exported reports
  await db.exec(`
    CREATE TABLE IF NOT EXISTS report_exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT,
      file_size INTEGER,
      format TEXT NOT NULL,
      parameters TEXT,
      status TEXT DEFAULT 'pending',
      downloaded_at DATETIME,
      exported_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(exported_by) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Indexes for Phase 9 tables
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
    CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
    CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
    CREATE INDEX IF NOT EXISTS idx_settings_history_setting ON settings_history(setting_id);
    CREATE INDEX IF NOT EXISTS idx_feature_toggles_key ON feature_toggles(feature_key);
    CREATE INDEX IF NOT EXISTS idx_feature_toggles_category ON feature_toggles(category);
    CREATE INDEX IF NOT EXISTS idx_feature_toggles_enabled ON feature_toggles(is_enabled);
    CREATE INDEX IF NOT EXISTS idx_report_cache_type ON report_cache(report_type);
    CREATE INDEX IF NOT EXISTS idx_report_cache_expires ON report_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_report_exports_type ON report_exports(report_type);
  `);

  // Insert default system settings
  await db.exec(`
    INSERT OR IGNORE INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES
    ('store_name', 'EcommerceApp', 'string', 'store', 'Store display name'),
    ('store_email', 'support@ecommerceapp.com', 'string', 'store', 'Store contact email'),
    ('store_phone', '+1234567890', 'string', 'store', 'Store contact phone'),
    ('store_address', '123 Main Street, City', 'string', 'store', 'Store physical address'),
    ('store_currency', 'USD', 'string', 'store', 'Default currency'),
    ('store_timezone', 'UTC', 'string', 'store', 'Store timezone'),
    ('tax_rate', '10', 'number', 'tax', 'Default tax rate percentage'),
    ('tax_enabled', 'true', 'boolean', 'tax', 'Enable tax calculation'),
    ('shipping_free_threshold', '50', 'number', 'shipping', 'Free shipping threshold amount'),
    ('shipping_default_cost', '5.99', 'number', 'shipping', 'Default shipping cost'),
    ('order_prefix', 'ORD', 'string', 'orders', 'Order number prefix'),
    ('invoice_prefix', 'INV', 'string', 'orders', 'Invoice number prefix'),
    ('max_cart_items', '50', 'number', 'cart', 'Maximum items per cart'),
    ('session_timeout', '3600', 'number', 'security', 'Session timeout in seconds'),
    ('password_min_length', '8', 'number', 'security', 'Minimum password length'),
    ('enable_2fa', 'false', 'boolean', 'security', 'Enable two-factor authentication'),
    ('maintenance_mode', 'false', 'boolean', 'system', 'Enable maintenance mode'),
    ('maintenance_message', 'We are currently performing maintenance. Please check back soon.', 'string', 'system', 'Maintenance mode message')
  `);

  // Insert default feature toggles
  await db.exec(`
    INSERT OR IGNORE INTO feature_toggles (feature_key, feature_name, description, is_enabled, is_kill_switch, category) VALUES
    ('user_registration', 'User Registration', 'Allow new user registrations', 1, 1, 'auth'),
    ('guest_checkout', 'Guest Checkout', 'Allow checkout without account', 1, 0, 'checkout'),
    ('product_reviews', 'Product Reviews', 'Allow users to review products', 1, 0, 'products'),
    ('wishlist', 'Wishlist', 'Enable wishlist functionality', 1, 0, 'products'),
    ('coupons', 'Coupon Codes', 'Enable coupon code functionality', 1, 0, 'checkout'),
    ('push_notifications', 'Push Notifications', 'Enable push notifications', 1, 1, 'notifications'),
    ('email_notifications', 'Email Notifications', 'Enable email notifications', 1, 1, 'notifications'),
    ('sms_notifications', 'SMS Notifications', 'Enable SMS notifications', 0, 0, 'notifications'),
    ('marketing_campaigns', 'Marketing Campaigns', 'Enable marketing campaigns', 1, 1, 'marketing'),
    ('live_chat', 'Live Chat Support', 'Enable live chat support', 0, 0, 'support'),
    ('order_tracking', 'Order Tracking', 'Enable order tracking', 1, 0, 'orders'),
    ('returns', 'Returns & Refunds', 'Enable returns and refunds', 1, 1, 'orders'),
    ('replacements', 'Replacements', 'Enable product replacements', 1, 0, 'orders'),
    ('inventory_alerts', 'Inventory Alerts', 'Enable low stock alerts', 1, 0, 'inventory'),
    ('multi_currency', 'Multi-Currency', 'Enable multiple currencies', 0, 0, 'payments'),
    ('payment_gateway', 'Payment Gateway', 'Enable online payments', 1, 1, 'payments')
  `);

  console.log('✅ Database tables created successfully');
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    console.log('✅ Database connection closed');
  }
}
