// Data Migration Script: SQLite to PostgreSQL
// Run with: npx tsx src/migrate-data.ts

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pg from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;

interface TableInfo {
  name: string;
  hasAutoIncrement: boolean;
}

async function migrate() {
  console.log('🚀 Starting SQLite to PostgreSQL migration...\n');

  // Check for DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required for migration');
    console.log('   Please set DATABASE_URL in your .env file');
    process.exit(1);
  }

  // Connect to SQLite
  const sqliteDbPath = path.join(process.cwd(), 'data', 'ecommerce.db');
  console.log(`📁 Opening SQLite database: ${sqliteDbPath}`);
  
  const sqliteDb = await open({
    filename: sqliteDbPath,
    driver: sqlite3.Database,
  });

  // Connect to PostgreSQL
  console.log('🐘 Connecting to PostgreSQL...');
  const pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await pgPool.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL\n');
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error);
    process.exit(1);
  }

  // Tables to migrate in order (respecting foreign key constraints)
  const tables: TableInfo[] = [
    { name: 'admins', hasAutoIncrement: true },
    { name: 'users', hasAutoIncrement: true },
    { name: 'categories', hasAutoIncrement: true },
    { name: 'stores', hasAutoIncrement: true },
    { name: 'products', hasAutoIncrement: true },
    { name: 'roles', hasAutoIncrement: true },
    { name: 'permissions', hasAutoIncrement: true },
    { name: 'role_permissions', hasAutoIncrement: true },
    { name: 'admin_roles', hasAutoIncrement: true },
    { name: 'orders', hasAutoIncrement: true },
    { name: 'order_items', hasAutoIncrement: true },
    { name: 'order_events', hasAutoIncrement: true },
    { name: 'order_sla', hasAutoIncrement: true },
    { name: 'cart', hasAutoIncrement: true },
    { name: 'wishlist', hasAutoIncrement: true },
    { name: 'payments', hasAutoIncrement: true },
    { name: 'invoices', hasAutoIncrement: true },
    { name: 'invoice_items', hasAutoIncrement: true },
    { name: 'shipments', hasAutoIncrement: true },
    { name: 'shipment_events', hasAutoIncrement: true },
    { name: 'return_requests', hasAutoIncrement: true },
    { name: 'return_events', hasAutoIncrement: true },
    { name: 'refunds', hasAutoIncrement: true },
    { name: 'replacement_orders', hasAutoIncrement: true },
    { name: 'tickets', hasAutoIncrement: true },
    { name: 'ticket_messages', hasAutoIncrement: true },
    { name: 'ticket_attachments', hasAutoIncrement: true },
    { name: 'ticket_escalations', hasAutoIncrement: true },
    { name: 'ticket_activities', hasAutoIncrement: true },
    { name: 'notification_logs', hasAutoIncrement: true },
    { name: 'notification_templates', hasAutoIncrement: true },
    { name: 'notification_template_versions', hasAutoIncrement: true },
    { name: 'event_trigger_rules', hasAutoIncrement: true },
    { name: 'notification_dlq', hasAutoIncrement: true },
    { name: 'marketing_campaigns', hasAutoIncrement: true },
    { name: 'campaign_segments', hasAutoIncrement: true },
    { name: 'campaign_logs', hasAutoIncrement: true },
    { name: 'category_marketing_rules', hasAutoIncrement: true },
    { name: 'user_notification_preferences', hasAutoIncrement: true },
    { name: 'user_marketing_preferences', hasAutoIncrement: true },
    { name: 'user_blocks', hasAutoIncrement: true },
    { name: 'user_activity_logs', hasAutoIncrement: true },
    { name: 'admin_logs', hasAutoIncrement: true },
    { name: 'admin_sessions', hasAutoIncrement: true },
    { name: 'login_attempts', hasAutoIncrement: true },
    { name: 'password_resets', hasAutoIncrement: true },
    { name: 'product_versions', hasAutoIncrement: true },
    { name: 'inventory_logs', hasAutoIncrement: true },
    { name: 'low_stock_alerts', hasAutoIncrement: true },
    { name: 'credit_notes', hasAutoIncrement: true },
    { name: 'credit_note_items', hasAutoIncrement: true },
    { name: 'couriers', hasAutoIncrement: true },
    { name: 'audit_logs', hasAutoIncrement: true },
    { name: 'system_settings', hasAutoIncrement: true },
    { name: 'settings_history', hasAutoIncrement: true },
    { name: 'feature_toggles', hasAutoIncrement: true },
    { name: 'feature_toggle_history', hasAutoIncrement: true },
    { name: 'report_cache', hasAutoIncrement: true },
    { name: 'report_exports', hasAutoIncrement: true },
    { name: 'activity_logs', hasAutoIncrement: true },
  ];

  let totalMigrated = 0;
  let tablesProcessed = 0;

  for (const table of tables) {
    try {
      // Check if table exists in SQLite
      const tableExists = await sqliteDb.get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [table.name]
      );

      if (!tableExists) {
        console.log(`⏭️  Skipping ${table.name} (not found in SQLite)`);
        continue;
      }

      // Get all rows from SQLite
      const rows = await sqliteDb.all(`SELECT * FROM ${table.name}`);
      
      if (rows.length === 0) {
        console.log(`⏭️  Skipping ${table.name} (empty table)`);
        continue;
      }

      console.log(`📦 Migrating ${table.name}: ${rows.length} rows...`);

      // Get column names from first row
      const columns = Object.keys(rows[0]);

      // Clear existing data in PostgreSQL (if any)
      await pgPool.query(`DELETE FROM ${table.name}`);

      // Insert rows into PostgreSQL
      for (const row of rows) {
        const values = columns.map((col) => row[col]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnList = columns.join(', ');

        try {
          await pgPool.query(
            `INSERT INTO ${table.name} (${columnList}) VALUES (${placeholders})`,
            values
          );
        } catch (insertError: any) {
          console.error(`   ⚠️ Error inserting row into ${table.name}:`, insertError.message);
        }
      }

      // Reset sequence for auto-increment tables
      if (table.hasAutoIncrement) {
        try {
          const maxId = await pgPool.query(
            `SELECT COALESCE(MAX(id), 0) as max_id FROM ${table.name}`
          );
          const nextVal = (maxId.rows[0].max_id || 0) + 1;
          await pgPool.query(
            `ALTER SEQUENCE ${table.name}_id_seq RESTART WITH ${nextVal}`
          );
        } catch (seqError: any) {
          // Sequence might not exist for some tables
        }
      }

      console.log(`   ✅ Migrated ${rows.length} rows`);
      totalMigrated += rows.length;
      tablesProcessed++;

    } catch (error: any) {
      console.error(`❌ Error migrating ${table.name}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`🎉 Migration complete!`);
  console.log(`   Tables processed: ${tablesProcessed}`);
  console.log(`   Total rows migrated: ${totalMigrated}`);
  console.log('='.repeat(50));

  // Close connections
  await sqliteDb.close();
  await pgPool.end();

  console.log('\n✅ Database connections closed');
}

// Run migration
migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
