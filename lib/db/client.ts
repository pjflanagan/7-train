/**
 * The database connection. Server only.
 *
 * Deliberately optional. A deployment with no `DATABASE_URL` is a supported
 * deployment: `isDatabaseConfigured` is false, the settings routes answer "not
 * configured", and the app runs with nowhere to keep settings or activities —
 * an empty planner that forgets everything on reload, which is the honest
 * behaviour for a deployment with no store behind it. It is not a deployment to
 * sign users in on; see `_docs/storage.md`.
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
