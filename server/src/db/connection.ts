/**
 * better-sqlite3 singleton with WAL pragmas.
 * @module db/connection
 */

import Database from 'better-sqlite3';
import { env } from '../env.js';

let instance: Database.Database | null = null;

/**
 * Get the SQLite database singleton.
 * Creates and configures on first call.
 * @returns The database instance
 */
export function getDb(): Database.Database {
  if (!instance) {
    instance = new Database(env.DATABASE_PATH);
    instance.pragma('journal_mode = WAL');
    instance.pragma('synchronous = NORMAL');
    instance.pragma('foreign_keys = ON');
    instance.pragma('busy_timeout = 5000');
    instance.pragma('cache_size = -20000');
  }
  return instance;
}

/**
 * Close the database connection.
 * @returns void
 */
export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
