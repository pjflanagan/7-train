# Storage: who owns what

Two stores, deliberately not interchangeable — and the browser is not one of
them.

| Store | Owns | Survives |
| --- | --- | --- |
| Google Calendar | Scheduled events, and each week's targets | Anything. It is the durable copy of the plan |
| Postgres (`users`, `accounts`, `activities`) | Settings, account ids, "My activities" | Anything, and follows the Google account |
| The browser | Nothing at all | Nothing. The store is memory, dropped on reload |

## Why the browser holds nothing

The plan used to be cached in `localStorage` under `workout-week`, and that
cache was the source of truth: the render path read only it, and the two remote
stores were replicas of it. That is exactly backwards from what people
experienced.

- **A sign out did not sign the plan out.** The store outlived the session, so
  the next person at the machine — or the same person on a shared laptop — saw
  the last one's week.
- **The next sign in pushed it up as theirs.** A browser holding a plan was, by
  design, the winner of the first sync, so one account's activities became
  another's.
- **Every loop was written twice.** Once for what the backend said and once for
  the cache that disagreed, with a hydration gate in front of everything so
  nothing acted on the seeded defaults the store held before `localStorage` was
  read.

So there is no cache. `usePlannerStore` is a plain zustand store — no `persist`,
no `migrate`, no `onRehydrateStorage` — and it starts empty on every load. What
is on screen has been fetched.

**What this costs, deliberately:** there is no signed-out mode. Signed out there
is nothing to fetch and nowhere to keep an edit, so the app does not pretend
otherwise — `PlannerPage` renders `SignInModal` and nothing else: no header, no
week behind it, and no way to dismiss it. An empty week that quietly forgets
every edit on reload is worse than a locked door, because it looks like it is
working. The legal pages are their own routes and stay reachable.

A deployment that wants a usable app therefore needs Google credentials *and* a
`DATABASE_URL`. With no Google credentials the door says so rather than offering
a sign in that can only fail.

**Where the sample plan went.** It is not what a fresh browser starts with any
more; it is what a brand new *account* starts from. `useUserSync` writes it once,
the first time the server says `isNew`, and pushes it up as the account's first
revision. `buildSeededState()` in `lib/store.ts` is the same data "full reset"
puts back.

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
private windows, new laptops and cleared caches. Now that the browser keeps
nothing, *every* load is that second browser, and the row is the only thing
standing between a user and a duplicate calendar.

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
- **Day notes and helpful links** — nowhere at all, and this is now a real gap
  rather than a device-sync one. Neither has ever had a backend, and with no
  cache in front of them they live in memory for as long as the tab is open: a
  note typed on Tuesday is gone on reload. Week targets are fine — Google
  Calendar holds those alongside the events — and `history` is a dead field
  nothing writes any more. Giving notes and links a home is the next piece of
  work this change makes necessary.

## Backend-first, precisely

- The app renders what it has fetched. The first paint of a signed in user is a
  spinner, held by `usePlannerLoaded()` until the settings pull and the calendar
  pull have landed — or until it is settled that neither is coming. Drawing an
  empty week at someone who has one is the failure this prevents.
- Every gate settles on failure as well as on success. A pull that errored has
  answered; the planner renders what little it has rather than spinning for
  ever.
- With no `DATABASE_URL`, `/api/user` answers 501 and there is nowhere for
  activities or settings to live. The app still runs, and forgets everything on
  reload.
- With no Google credentials, sign-in is not offered at all rather than offered
  and broken.
- **The one combination to avoid** is Google sign-in *without* `DATABASE_URL`.
  Since the "which calendar?" question was removed, a browser with no calendar
  id creates one — and with nowhere to record that, every load creates another
  calendar. A deployment that signs users in must have a database.
- **Signing out empties the store**, via `useSignedOutReset`, and drops the user
  back at the sign in. A sign out is not a page load: the session flips and
  React carries on with the same state in memory, so the wipe is deliberate.

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
A session predating the fix simply has no `googleSub` and gets a 401 from
`/api/user`, which now means an empty planner until the next sign in issues a
token that works.

`scripts/db-cleanup-orphan-users.mjs` deletes rows left by the old behaviour
(dry run by default, `--apply` to commit).

## Shapes and migrations

- `lib/migrate.ts` still exists, and has exactly one caller left: backup import.
  The chain runs to `CURRENT_STATE_VERSION` (10), and `BACKUP_VERSION` *is* that
  constant rather than a second number kept in step by hand — a backup stamped
  older gets needlessly re-migrated on import, which
  `__tests__/backup.test.ts` catches. `importLegacy`, which read the pre-Next
  `workout_week_*` keys out of `localStorage`, is gone with the storage it read.
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

- `__tests__/noLocalStorage.test.ts` — the store starts blank, writes nothing to
  `localStorage`, and has no `persist` to rehydrate from.
- `__tests__/signedOutReset.test.ts` — a sign out empties the plan, and a load
  that starts signed out does not.
- `__tests__/plannerLoadedGate.test.ts` — every state of `usePlannerLoaded`,
  including the ones that must not leave a spinner up for ever.
- `__tests__/signInGate.test.tsx` — the door offers a sign in, has no way past
  it, and says so instead when there are no Google credentials.
- `__tests__/backup.test.ts` — version stamping, and what a backup excludes.
- `__tests__/storeMigration.test.ts` — every version step.
- `__tests__/userSettings.test.ts` — the first-pull merge, including that a
  remote `googleCalendarId` never loses to a local one.
