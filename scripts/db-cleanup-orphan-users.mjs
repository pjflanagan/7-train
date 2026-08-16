/**
 * Deletes `users` rows whose `google_sub` is not a Google subject claim.
 *
 * ## What went wrong
 *
 * `readSessionIdentity` used to return `token.sub`. With the JWT session
 * strategy and no database adapter, Auth.js mints a **fresh UUID** for
 * `token.sub` on every sign in — it is a session id, not an account id. So
 * every login looked like a brand new person: a new `users` row, a new
 * `accounts` row, and a settings record that knew nothing about the calendar
 * the previous one had made.
 *
 * The unique indexes on `users.google_sub` and `accounts(provider,
 * external_id)` were never violated. They did their job perfectly on a key that
 * was wrong.
 *
 * `lib/auth.ts` now stores `account.providerAccountId` — Google's real `sub` —
 * and `lib/sessionServer.ts` reads that, refusing anything UUID-shaped.
 *
 * ## What this deletes
 *
 * Only rows whose `google_sub` matches a v4 UUID. A real Google `sub` can never
 * match, so a correctly-created row is never at risk. `accounts` and
 * `activities` go with them by `ON DELETE CASCADE`.
 *
 * ## Why deleting is safe
 *
 * The plan is local-first. `googleCalendarId`, the activities and every setting
 * are still in the browser's `localStorage`, and `mergeOnFirstPull` pushes the
 * local copy up when the server has nothing — so the next sign in re-creates
 * one correct row pointing at the *same* `Workouts` calendar. Nothing is
 * recovered from these rows that the browser does not already hold.
 *
 * Sign in from a browser that already has your plan, not a fresh one.
 *
 * ## Usage
 *
 *   node scripts/db-cleanup-orphan-users.mjs           # dry run, changes nothing
 *   node scripts/db-cleanup-orphan-users.mjs --apply   # actually delete
 */

import pkg from '@next/env';
import { neon } from '@neondatabase/serverless';

pkg.loadEnvConfig(process.cwd());

const APPLY = process.argv.includes('--apply');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Nothing to do.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

/** Same shape `lib/sessionServer.ts` refuses. Postgres POSIX regex. */
const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

const orphans = await sql`
  select u.id, u.email, u.google_sub, u.google_calendar_id, u.created_at,
         (select count(*)::int from activities a where a.user_id = u.id) as activities
  from users u
  where u.google_sub ~* ${UUID}
  order by u.created_at
`;

const keepers = await sql`
  select count(*)::int as n from users where google_sub !~* ${UUID}
`;

console.log(`\n${orphans.length} orphaned user row(s); ${keepers[0].n} valid row(s) will be kept.\n`);

if (orphans.length === 0) {
  console.log('Nothing to clean up.');
  process.exit(0);
}

for (const row of orphans) {
  console.log(
    `  ${row.created_at.toISOString()}  ${row.email ?? '(no email)'}` +
      `  activities: ${row.activities}` +
      `  calendar: ${row.google_calendar_id ?? 'none'}`
  );
}

// The one thing worth carrying out of here by hand, if anything goes wrong.
const calendars = [...new Set(orphans.map((r) => r.google_calendar_id).filter(Boolean))];
console.log(
  `\nCalendar id(s) referenced by these rows (${calendars.length}):\n` +
    calendars.map((c) => `  ${c}`).join('\n')
);
if (calendars.length > 1) {
  console.log(
    '\n  ⚠ More than one calendar is referenced, so these rows do not all describe\n' +
      '    the same plan. Check which one your browser is using before applying.'
  );
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to delete.');
  process.exit(0);
}

const deleted = await sql`
  delete from users where google_sub ~* ${UUID} returning id
`;
console.log(`\nDeleted ${deleted.length} user row(s), and their accounts and activities.`);

const after = await sql`select count(*)::int as n from users`;
const afterAccounts = await sql`select count(*)::int as n from accounts`;
const afterActivities = await sql`select count(*)::int as n from activities`;
console.log(
  `Remaining — users: ${after[0].n}, accounts: ${afterAccounts[0].n}, ` +
    `activities: ${afterActivities[0].n}`
);
console.log('\nNow sign in from a browser that already has your plan.');
