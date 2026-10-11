import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

const rootEnvPath = path.resolve(process.cwd(), '.env');
const serverEnvPath = path.resolve(process.cwd(), 'server', '.env');
const parentEnvPath = path.resolve(process.cwd(), '..', '.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else if (fs.existsSync(parentEnvPath)) {
  dotenv.config({ path: parentEnvPath });
} else {
  dotenv.config();
}

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/youtube_watch_party';

export const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 3000,
});

// Suppress unhandled pool error logging if database is offline
pool.on('error', (err) => {
  console.warn('[Database Pool Warning]', err.message);
});

export const db = drizzle(pool, { schema });

/**
 * Helper to check database connectivity
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (error: any) {
    const maskedConnStr = connectionString.replace(/:([^@]+)@/, ':****@');
    console.warn(`[PostgreSQL Connection Error]: ${error.message || error}`);
    console.warn(`[Target Connection String]: ${maskedConnStr}`);
    console.warn('[Database Fallback]: Server is operating in active in-memory state fallback mode.');
    return false;
  }
}
