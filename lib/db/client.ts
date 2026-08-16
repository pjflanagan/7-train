/**
 * The database connection. Server only.
 *
 * Deliberately optional. The planner is local-first and must work signed out
 * and offline exactly as it does today — remote storage is a replica, never a
 * prerequisite for rendering. So a deployment with no `DATABASE_URL` is a
 * supported deployment: `isDatabaseConfigured` is false, the settings routes
 * answer "not configured", and the app behaves precisely as it did before this
 * existed.
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

/**
 * Built once per server instance, and only if it is actually asked for — a
 * deployment without a database should never construct a client at import time
 * just to throw when the module loads.
 */
let cached: ReturnType<typeof build> | null = null;

function build() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return drizzle(neon(url), { schema });
}

export function getDb() {
  cached ??= build();
  return cached;
}

export type Database = ReturnType<typeof getDb>;
