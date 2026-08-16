import { loadEnvConfig } from '@next/env';
import type { Config } from 'drizzle-kit';

// `drizzle-kit` is its own CLI, so nothing has loaded `.env.local` for it the
// way `next dev` does for the app. This is Next's own loader, so the URL the
// migration runs against is exactly the one the running app will use — rather
// than whatever happens to be exported in the shell.
loadEnvConfig(process.cwd());

/**
 * Schema lives in `lib/db/schema.ts`; the SQL it generates is committed under
 * `drizzle/` so a deploy applies reviewed migrations rather than pushing a
 * schema diff at a live database.
 */
export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Only read by the commands that actually talk to a database (`migrate`,
    // `studio`). `generate` works offline, which is how migrations get written
    // without anyone holding production credentials.
    url: process.env.DATABASE_URL ?? '',
  },
} satisfies Config;
