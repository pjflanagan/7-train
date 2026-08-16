# Manual: setting up the database

Phase 1 of `_todo/database.md` is built: a `users` table holding settings, an
`accounts` table for third-party account ids, and an `activities` table for "My
activities". What is left is creating a database and running one migration.

Until `DATABASE_URL` is set the app behaves **exactly** as it did before — the
routes answer 501, the client shrugs and carries on with `localStorage`. There
is no half-broken state to get stuck in, so there is no rush.

Budget about ten minutes.

---

## 1. Create a Neon project

Go to **https://console.neon.tech**, sign in, and create a project. Anything
sensible for the name; pick the region closest to where the app is deployed.

The free tier is far past what this needs — the whole dataset is a few rows per
user.

On the project dashboard, copy the **connection string**. It looks like:

```
postgresql://user:password@ep-something-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Take the **pooled** one if you are offered a choice. The app talks to Neon over
their serverless HTTP driver, which suits a serverless deploy where every
request may be a fresh instance.

## 2. Put it in the environment

```bash
# .env.local — never commit this
DATABASE_URL=postgresql://user:password@ep-something-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

And in Netlify: **Site configuration → Environment variables**, same key.

## 3. Run the migration

```bash
npm run db:migrate
```

That applies `drizzle/0000_lying_dreadnoughts.sql`, which creates the three
tables. `drizzle.config.ts` loads `.env.local` through Next's own env loader, so
it reads the same `DATABASE_URL` the running app does — no need to export
anything in your shell first.

Run it once locally against the same database the deploy uses. There is no
migration step wired into the build, deliberately: a build that silently alters
a live schema is a bad afternoon waiting to happen.

Check it landed:

```bash
npm run db:studio     # opens a browser UI onto the tables
```

## 4. Confirm it works

1. Restart `next dev`.
2. Sign in with Google. The first sign-in uploads whatever this browser is
   holding — your settings and your activities — as the first revision.
3. In `db:studio`, the `users` table now has a row with your `google_sub` and
   your `google_calendar_id`, and `activities` has a row per activity.
4. **The real test:** open the app in a private window and sign in with the same
   account. It should land on the same `Workouts` calendar, silently. Nothing
   asks which calendar to use — a first sign-in makes one, and every sign-in
   after that is told which one the account already has.

That last step is the entire point of this phase. Before it, every fresh browser
made a *second* calendar and split the plan across both, permanently.

---

## What is stored, and what is not

| Stored | Not stored |
| --- | --- |
| Google account id (`sub`), email, name | Any Google token — those stay in the session JWT |
| `googleCalendarId`, `googleAdoptedAt`, `googleSheetId` | Events — Google Calendar is the store for those |
| Week start, temperature unit, 24-hour clock, default start time | Week targets, day notes, links, history — still local only |
| "My activities", in your own order | Strava tokens — still in their own encrypted cookie |

The last one is worth being deliberate about. Moving Strava's refresh token into
this table is what would let a pull run on a schedule with no browser open, and
it is a meaningfully bigger security surface than the current design, where the
server holds no third-party credentials at rest at all. It is listed as an open
question in `_todo/database.md` and is not settled by this phase.

## Things worth knowing

**Two devices do not yet live-update each other.** A change on one lands on the
other at its next load. Polling on focus would fix it and is cheap; websockets
are not needed for a single-user planner.

**Activities are written as a whole list**, not as a diff, because that is how
they are edited — as a list, and reordered as a list. Removing one leaves a
tombstone (`deleted_at`) rather than deleting the row, so the removal reaches a
device that has not heard about it instead of that device pushing the activity
straight back up.

**The activity itself is a `jsonb` blob**, validated by `ActivitySchema` on the
way in and out. `lib/types.ts` moves — `stravaSportTypes` was added to it this
week — and a column per field would mean a database migration every time, for
data only ever read and written whole. Sorting and reconciliation fields
(`sort_order`, `revision`, `deleted_at`) are real columns.

**`plan_id` on `activities` is nullable and unused.** It is there for training
two things at once — a half marathon and a tri, each with its own activities and
its own calendar (`_todo/griley-ideas.md`). Adding the column now costs nothing;
retrofitting one onto a populated table costs a great deal. Nothing reads it.

**Local-first is intact for rendering.** Signed out or offline, the plan draws
from `localStorage` exactly as it always did. The database is a replica, never a
prerequisite for showing you your week.

**But the database is now load-bearing for the calendar id.** Since the "which
calendar?" question was removed, `useEnsureCalendar` makes one silently when the
account has none — and without `DATABASE_URL` there is nowhere to record that it
did. A second browser would then make a second `Workouts` calendar, which is the
original bug. So: a deployment that signs users in should have a database. One
that does not is fine, and one that has neither is fine; the combination to
avoid is Google sign-in without `DATABASE_URL`.

## What is next

From `_todo/database.md`, in order of payoff:

- **Week targets, notes and links** (phase 4's remainder). This is what makes a
  second device show the same *plan*, not just the same settings. The tables
  follow the same shape as `activities`.
- **The sync engine** (phase 2). Today `useCalendarSync`, `useStravaSync` and
  `useUserSync` each carry their own debounce, ready flag and in-flight guard.
  Three is the point at which the pattern should become one outbox.
- **Strava tokens server side**, if scheduled pulls are wanted.
