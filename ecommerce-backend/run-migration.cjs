#!/usr/bin/env node

// Migration script to add initiated_by column to refunds table
// Run this in terminal: node run-migration.cjs

const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not set in environment (.env file)');
    process.exit(1);
  }

  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false } 
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!');

    console.log('🔄 Running migration: Add initiated_by column to refunds table...');
    
    // Add initiated_by column if it doesn't exist
    await client.query(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'refunds' AND column_name = 'initiated_by'
          ) THEN
              ALTER TABLE refunds ADD COLUMN initiated_by INTEGER;
              RAISE NOTICE 'Column initiated_by added to refunds table';
          ELSE
              RAISE NOTICE 'Column initiated_by already exists in refunds table';
          END IF;
      END $$;
    `);

    console.log('✅ Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Added initiated_by column to refunds table');
    console.log('   - This tracks which admin created the refund');
    console.log('\n🎉 Refunds will now appear in Refunds menu after being created from Returns menu!');

  } catch (err) {
    console.error('❌ Error running migration:', err.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure DATABASE_URL is set in your .env file');
    console.error('2. Check your Render PostgreSQL connection string');
    console.error('3. Verify the database is accessible');
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
