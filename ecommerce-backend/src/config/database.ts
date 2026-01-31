// Main Database Module - Routes to appropriate database driver
// Set DATABASE_URL environment variable for PostgreSQL
// Leave DATABASE_URL empty for SQLite (local development)

import dotenv from 'dotenv';
dotenv.config();

// Determine which database to use based on DATABASE_URL
const usePostgres = !!process.env.DATABASE_URL;

// Dynamic import based on database type
let dbModule: any = null;
let db: any = null;

async function loadDatabaseModule() {
  if (dbModule) return dbModule;
  
  if (usePostgres) {
    console.log(' Using PostgreSQL database');
    dbModule = await import('./database.pg.js');
  } else {
    console.log(' Using SQLite database (local development)');
    dbModule = await import('./database.sqlite.js');
  }
  return dbModule;
}

export async function initializeDatabase(): Promise<any> {
  if (db) {
    return db;
  }
  
  const module = await loadDatabaseModule();
  db = await module.initializeDatabase();
  return db;
}

export function getDatabase(): any {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    const module = await loadDatabaseModule();
    await module.closeDatabase();
    db = null;
  }
}
