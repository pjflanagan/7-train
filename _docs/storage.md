# Storage: who owns what

Three stores, deliberately not interchangeable.

| Store | Owns | Survives |
| --- | --- | --- |
| `localStorage` (`workout-week`) | Everything, always. The render path reads only this. | Nothing — clearing site data clears it |
| Google Calendar | Scheduled events, and each week's targets | Anything. It is the durable copy of the plan |
| Postgres (`users`, `accounts`, `activities`) | Settings, account ids, "My activities" | Anything, and follows the Google account |

## Why the plan is in Google Calendar and not our database

Because a workout is a thing at a time, and people already own a calendar. The
plan being in Google Calendar means it is on a phone lock screen, in a work
calendar's free/busy, and editable from anywhere — including by dragging an
event to another day, which syncs back here.

The scope is `calendar.app.created`, which reaches **only** calendars this app
made itself. We cannot read, and have never been able to read, the rest of
someone's calendar.

## Why settings are in Postgres and events are not

One reason, and it is enough: `googleCalendarId`. It is the only thread back to
a user's calendar, and while it lived in `localStorage` a second browser could
not find the calendar the first one made — so it made another, and the plan
forked across two calendars permanently. Keyed to the Google `sub`, it survives
private windows, new laptops and cleared caches.

Events do not need this. Google Calendar already holds them, already syncs them
across devices, and already survives everything. Duplicating them into Postgres
would create a second source of truth to reconcile, for no gain.

**Not stored server-side, deliberately:**

- **Google tokens** — they stay in the NextAuth session JWT.
- **Strava tokens** — an `AUTH_SECRET`-encrypted httpOnly cookie. Moving them
  into the database is what would let a pull run with no browser open, and is a
  meaningfully larger security surface than the current design, where the server
  holds no third-party credentials at rest. Open question in
  `_todo/database.md`; not settled.
- **Week targets, notes, links, history** — still local only. This is the gap
  that stops a second device showing the same *plan* rather than the same
  settings.

## Local-first, precisely

- The app renders from `localStorage` and nothing else. No spinner ever waits on
  Google or on Postgres.
- With no `DATABASE_URL`, `/api/user` answers 501, the client shrugs, and
  behaviour is exactly as it was before the database existed.
- With no Google credentials, sign-in is not offered at all rather than offered
  and broken.
- **The one combination to avoid** is Google sign-in *without* `DATABASE_URL`.
  Since the "which calendar?" question was removed, a browser with no calendar
  id creates one — and with nowhere to record that, a second browser creates a
  second calendar. That is the original bug. A deployment that signs users in
  should have a database.

## Identity: the key everything hangs off

`users.google_sub` must be **Google's own subject claim**, taken from
`account.providerAccountId` at sign-in and carried on the JWT as `googleSub`.

Never `token.sub`. With the JWT strategy and no adapter, Auth.js mints a fresh
UUID for `token.sub` on every sign in — it identifies a session, not an account.
Keying on it made one person five `users` rows in a day, and would have handed a
returning user an empty settings row that did not know which calendar was
theirs. The unique indexes were never violated; they worked correctly on a wrong
key, which is why nothing failed loudly.

`isUsableGoogleSub` in `lib/sessionServer.ts` refuses a UUID-shaped id outright.
A session predating the fix simply has no `googleSub`, gets a 401 from
`/api/user`, and falls back to local storage until the next sign in.

`scripts/db-cleanup-orphan-users.mjs` deletes rows left by the old behaviour
(dry run by default, `--apply` to commit).

## Shapes and migrations

- The persisted store is versioned (`version: 10`) and migrated in
  `lib/migrate.ts`. `BACKUP_VERSION` must equal the store's version — a backup
  stamped older gets needlessly re-migrated on import, which
  `__tests__/backup.test.ts` now catches.
- `googleCalendarName` is a **cache of Google's state, not a setting**. It is
  never pushed to the database and is excluded from backups; a rename in Google
  Calendar reaches us on the next pull.
- An activity is a `jsonb` blob validated by `ActivitySchema`, because it is
  only ever read and written whole and `lib/types.ts` still moves. Sorting and
  reconciliation fields (`sort_order`, `revision`, `deleted_at`) are real
  columns.
- Removing an activity writes a **tombstone**, not a delete, so the removal
  reaches a device that has not heard about it instead of that device pushing
  the activity back up.
- `plan_id` on `activities` is nullable and unused — room for training two
  things at once. Nothing reads it.

## How this is enforced

- `__tests__/backup.test.ts` — version stamping, and what a backup excludes.
- `__tests__/storeMigration.test.ts`, `__tests__/migrate.test.ts` — every
  version step.
- `__tests__/userSettings.test.ts` — the first-pull merge, including that a
  remote `googleCalendarId` never loses to a local one.
