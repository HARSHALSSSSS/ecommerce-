// Node.js script to execute schema.pg.sql on NeonDB using pg
const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

async function runSchema() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set in environment.');
    process.exit(1);
  }
  const sql = fs.readFileSync('schema.pg.sql', 'utf8');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    // Split on semicolon, filter out empty, run each statement
    for (const stmt of sql.split(';')) {
      const trimmed = stmt.trim();
      if (trimmed) {
        await client.query(trimmed);
      }
    }
    console.log('✅ Schema created successfully on NeonDB!');
  } catch (err) {
    console.error('❌ Error running schema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSchema();
