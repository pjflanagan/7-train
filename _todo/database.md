# Adding a database

> **Status: phase 1 has landed.** `users` (identity + settings), `accounts`
> (third-party account ids) and `activities` are live, with `GET`/`PUT
> /api/user` and `hooks/useUserSync.ts` in front of them. Setup is
> `_todo/-MANUAL-database-setup.md`. The calendar-id problem this document opens
> with is **solved**; everything below about weekActivities, notes, links,
> history, the outbox and the connector interface is still ahead.
>
> Two decisions the phase settled, both flagged as open questions below:
> `planId` exists as a nullable column on `activities` and nothing reads it, so
> the multiple-plans door is open at no cost; and Strava's tokens stayed in
> their cookie, so the server still holds no third-party credentials at rest.

Right now the plan lives in `localStorage` (`usePlannerStore` + `persist`) and,
if the user connects it, is mirrored into a `Workouts` Google calendar by
`hooks/useCalendarSync.ts`. That was a deliberate "no database" call — see
`_todo/done/2026-08-12-integration-google-continued.md`.

**The division of labour has since been decided** (`_todo/google-calendar-as-storage.md`):

> **Google Calendar stores events. A database, if we add one, stores user
> settings and activities — nothing else.**

An event carries its own `activitySnapshot` and week, so it renders with no help
from local state. That removes the sharpest reason this document originally
existed: "an event for an activity this device does not have is silently
skipped". Read that document first; this one is only about the *other* half —
the settings that a calendar event has nowhere to put.

### The sharpest case for it: the calendar id

`googleCalendarId` lives in `localStorage` and is **the only way back to the
user's `Workouts` calendar**. There is no lookup to fall back on: searching
calendars means `calendarList.list`, which does not accept
`calendar.app.created` (it returns 403 "insufficient authentication scopes"),
and the scopes that do accept it read *every* calendar the user owns — which is
precisely what the narrow-scope design refuses to ask for. See
`ensureWorkoutsCalendar` in `lib/googleCalendar.ts`.

So every way of losing that one string creates a second `Workouts` calendar,
permanently, with the events split across both:

- clearing site data,
- a different browser or device,
- a private window,
- any bug that nulls it (one shipped, and made three calendars before it was
  caught — `clearAll` used to reset it).

Two repairs existed, and neither was a fix: `CalendarSetupModal` asked on a
browser with no calendar id — adopt one by pasting its id, or make a new one —
and `CalendarPicker` offered the same choice later in the integrations modal.
Both were the user doing by hand what a `users` row does by itself.

**The fix is storing the id against the user's Google `sub` rather than against
a browser** — one row, `users.googleCalendarId`, which makes a second device
resume the same calendar instead of forking one.

**Both repairs have since been deleted.** With the id on the account, a browser
holding no calendar id is not one that needs a new calendar, it is one that has
not read its settings yet — so `useEnsureCalendar` waits for the settings pull
and then makes one silently if the account genuinely has none. There is no
question and no picker; which calendar the plan lives in is not a user-facing
choice any more.

This is the smallest possible version of this document and the one with the
clearest payoff. If the rest of the design is too big to start, start here.

What still pushes toward a database:

- a second device, which needs the same activities, targets and settings (events
  already travel via the calendar) — and, above all, needs to find the *same*
  calendar rather than making its own,
- Strava (`_todo/integration-strava.md`) and Garmin
  (`_todo/integration-garmin.md`), which are _readers_ that write back into the
  same events the calendar is also writing,
- scheduled work (Sheets export, connector pulls) that must run when no browser
  is open.

With more than one writer per event, ad-hoc syncing in each hook does not scale —
`useCalendarSync` already carries a hand-rolled baseline map, a debounce, a ready
flag and an in-flight guard, and each new integration would grow its own copy.

**This document is about the settings store and the sync infrastructure**, with
the calendar staying the event store rather than being demoted to a mirror.

---

## Principles

1. **Local-first stays.** The app must work signed out and offline, exactly as
   it does today. Remote storage is a replica, never a prerequisite for render.
2. **Events live in the calendar.** Google Calendar is the durable store for
   `events`; a database row for an event exists only as a cache/index, never as
   the authority. An event is self-describing on the wire.
3. **The database is for settings.** `activities`, `weekActivities`, `notes`,
   `links` and the per-user preferences — the things with no calendar
   representation. Strava and Garmin sync against our event records and reach
   the calendar through the same connector everything else uses; two connectors
   never talk directly.
4. **Writes are batched and debounced.** A user dragging a workout through the
   day produces one write, not forty. Target: no more than one round trip per
   entity per ~1.5s of continuous editing.
5. **Every write is explainable to the user.** There is always an honest answer
   to "is my stuff saved?" — see [Sync visibility](#sync-visibility).

---

## Data model

Five tables. Ids stay client-generated (they already are), so an offline edit
keeps its identity when it lands.

| Table              | Notes                                                             |
| ------------------ | ----------------------------------------------------------------- |
| `users`            | Google `sub` as the external id, plus settings currently in the store (`weekStartsOn`, `tempUnit`, `use24HourClock`, `defaultStartMinutes`, `googleCalendarId`, `googleSheetId`). |
| `activities`       | `ActivitySchema`, per user — "My activities", the template a week is built from. |
| `weekActivities`   | `(userId, weekStart, activityId) -> ActivitySchema`. One week's own copy of a target. |
| `notes`            | `(userId, weekStart, day) -> text`. |
| `links`            | `HelpfulLinkSchema`, per user. |
| `history`          | `HistoryEntrySchema`. Append-mostly; this is what Sheets export reads. |

**No `events` table as the authority.** Events are read from and written to
Google Calendar. If profiling shows the round trip is too slow for a cold load,
add an `events` cache table populated from the calendar — but it is a cache, its
rows are disposable, and a conflict is always resolved by re-reading Google.

Every synced row carries, in addition to its domain fields:

```ts
revision: number;      // server-incremented, monotonic per row
updatedAt: string;     // ISO, last edit to the *content*
deletedAt: string|null;// soft delete — a tombstone, so deletes propagate
source: 'local' | 'google' | 'strava' | 'garmin';  // who last wrote it
externalIds: { google?: string; strava?: string; garmin?: string };
```

`updatedAt` and the "bookkeeping does not bump it" rule already exist on
`ScheduledEvent` and are load-bearing — keep that comment's intent. `revision` is
new and is what makes an incremental pull possible: the client asks for
`revision > lastSeen` instead of re-reading a 20-week window every load.

Tombstones need a sweep — delete rows whose `deletedAt` is older than, say, 90
days, well past any plausible offline window.

### Zod

`lib/types.ts` schemas stay the wire contract. Add a `SyncMetaSchema` and
compose: `const SyncedActivitySchema = ActivitySchema.extend(SyncMeta)`. The
store keeps holding the plain domain types; sync metadata lives beside the data
in a `syncMeta` map keyed by entity id, so component code never sees it.

### Recommended stack

Postgres on Neon with Drizzle. Reasons: Vercel/Netlify-friendly serverless
driver, real transactions (the batch endpoint needs one), cheap-to-free at this
size, and Drizzle's schema-in-TypeScript sits well next to the Zod schemas we
already maintain. Turso/SQLite is the lighter alternative if the hosting story
changes; the design below does not depend on which.

Auth already yields a stable Google `sub` via NextAuth (`lib/auth.ts`); no new
identity system is required. A signed-out user simply has no `userId` and never
reaches the sync engine.

---

## The sync engine

### Shape

```
components ──dispatch──▶ usePlannerStore  ──subscribe──▶ syncEngine
                              │                              │
                         localStorage                    outbox (persisted)
                                                             │
                                        ┌────────────────────┼──────────────────┐
                                        ▼                    ▼                  ▼
                                  db connector      google calendar        strava/garmin
                                (settings, activities)  connector             connectors
                                                      (events — the store)    (pull-only)
```

New files:

- `lib/sync/outbox.ts` — the pending-change queue.
- `lib/sync/engine.ts` — scheduling, batching, retry, conflict resolution.
- `lib/sync/connectors/*.ts` — one per remote, all implementing one interface.
- `hooks/useSyncStatus.ts` — the store the UI watches. Generalises today's
  `useCalendarSyncStatus`.
- `app/api/sync/route.ts` — `GET` for a delta pull, `POST` for a batch push.

### Outbox

Every store mutation that touches synced data appends an intent:

```ts
interface PendingChange {
  id: string;                     // change id, for idempotency
  entity: 'activity' | 'weekActivity' | 'event' | 'note' | 'link' | 'history' | 'settings';
  entityId: string;
  op: 'upsert' | 'delete';
  at: number;                     // client clock, for ordering
}
```

Only the id, not a snapshot — the payload is read from the store at flush time.
That is what collapses forty drag frames into one write: repeated changes to the
same `(entity, entityId)` coalesce to a single outbox row.

The outbox is persisted alongside the plan, so a tab closed mid-edit flushes on
next load. This is also what makes offline work: a failed flush leaves the
outbox intact rather than losing the edit.

### Flush policy

- **Debounce 5000ms** on the trailing edge (matching today's
  `SYNC_DEBOUNCE_MS`), chosen to keep API traffic down. A long continuous drag
  therefore holds everything until the user stops; a **max wait** that
  checkpoints mid-edit is still worth adding, and matters more at 5s than it did
  at 1.2s.
- **Flush immediately** on `visibilitychange` → hidden, and on `pagehide`, so
  closing the tab does not strand a write.
- **One in-flight batch at a time.** Changes arriving during a flush queue for
  the next one — the current code's `isPushing` guard, generalised.
- **Batch cap** ~200 entities per request; split beyond that.
- **Retry** with exponential backoff (1s, 2s, 4s, 8s, capped at 30s) and full
  jitter. Give up loudly after ~5 attempts: status goes `error`, the outbox is
  kept, and the user gets a retry affordance rather than a toast that scrolls
  away.

Expected cost: an active editing session should be **single-digit writes per
minute**, and a page load should be **one delta request**, not a window scan.

### Conflict resolution

Per row, not per document.

1. Compare `revision`. If the client's base revision matches the server's, the
   write applies and the revision increments.
2. If it does not, the server returns the winner rather than rejecting: newer
   `updatedAt` wins, ties broken by `source` precedence.
3. **Source precedence:** `strava`/`garmin` (a recorded fact) > `local` (an
   intention the user just expressed) > `google` (often a stale mirror).
   Strava's own rule from `_todo/integration-strava.md` — keep our event if it
   was edited more recently than the Strava post, because people start recording
   late — falls out of step 2 and overrides precedence; precedence only settles
   genuine ties.
4. The client applies the returned winner and clears that outbox row.

Deletes are tombstones and a delete always beats a concurrent edit, otherwise a
row resurrects on the device that had not seen the delete yet.

### Connector interface

```ts
interface SyncConnector {
  id: 'google-calendar' | 'strava' | 'garmin';
  direction: 'push-pull' | 'pull-only';
  isEnabled(session): boolean;
  pull(range: DateRange, cursor?: string): Promise<ConnectorChange[]>;
  push?(changes: EntityPayload[]): Promise<PushResult>;
  /** Rate limits and windows the engine must respect. */
  policy: { minPullIntervalMs: number; maxWindowWeeks: number };
}
```

`policy` is where Strava's "only this week and last week" and Garmin's API
limits get declared once, and the engine enforces them, instead of each hook
remembering its own rules.

Connector pulls run **server side** on a schedule or on demand, write into our
tables, and reach the client through the same delta pull as everything else. The
browser then has exactly one thing to sync with, which is the whole point of
making the database the hub.

---

## Sync visibility

Today's status is one enum for one integration. Generalise to per-target state,
plus one derived headline:

```ts
type TargetStatus = 'off' | 'idle' | 'pulling' | 'pushing' | 'error' | 'retrying';

interface SyncState {
  targets: Record<string, { status: TargetStatus; lastSyncedAt?: string; error?: string }>;
  pendingCount: number;   // outbox length — "3 changes not saved yet"
  isOffline: boolean;
}
```

Headline rule, in order: offline → any error → any pushing/pulling →
`pendingCount > 0` → all clear.

In the UI:

- **Header indicator** — a small dot beside the avatar. Quiet when synced; it
  should not nag. Animated while syncing, warning-coloured on error. Copy is
  sentence case per `AGENTS.md`: "all changes saved", "saving…", "3 changes
  waiting", "couldn't save — retry".
- **Integrations modal** — a row per connector with its own last-synced time,
  its own status and its own resync button. This replaces the single resync
  nonce.
- **Never block the UI.** The plan renders from local state regardless. A failed
  sync is a banner, not a modal.
- **Offline** — `navigator.onLine` plus a failed-flush heuristic (the flag lies
  on captive portals). Say "offline — changes saved on this device", and flush
  on reconnect.

---

## Migration

The first sign-in after this ships has a populated `localStorage` and an empty
database. Upload local settings and activities as the initial revision, then
pull. Events are not uploaded — they are already in, or on their way to, the
calendar, and match on `googleEventId`, which events already carry, so a user who
has been syncing to Google does not get doubles.

Keep `localStorage` as the offline cache afterwards; it stops being the source
of truth but stays the thing that makes a cold load instant.

Signed-out users are untouched: no `userId`, no engine, the app as it is today.

---

## Phases

Each phase ships on its own and leaves the app working.

**1 — Schema and API. ✅ Done.** Landed as `users`, `accounts` and `activities`
with `revision`/`updatedAt`/`deletedAt` metadata, and `GET`/`PUT /api/user`
rather than the `/api/sync` delta endpoint described above — a delta pull needs
the outbox to be worth having, and settings are one small row. `source` is not
on the rows yet; it starts mattering when a second writer touches the same
entity, which for settings and activities is not yet true.

Also landed, ahead of phase 2 but too small to hold back: `hooks/useUserSync.ts`
does the pull, the first-sign-in merge (`mergeOnFirstPull`) and a debounced
push. It is a fourth hand-rolled sync loop, which is the argument for phase 2,
not against it.

**2 — Engine and outbox.** `lib/sync/*`, the db connector, the migration path,
the header indicator. At the end of this phase the plan persists to Postgres and
survives a device switch. Google sync is untouched and still runs its old path.

**3 — Calendar onto the engine.** Rewrite `useCalendarSync` as a connector,
still reading and writing Google as the event store. Delete the bespoke baseline
map, debounce and ready flag; the engine owns them. Move the pull server side.
This is the proof the abstraction is right — if the calendar does not fit
cleanly, fix the engine before phase 4. Depends on
`_todo/google-calendar-as-storage.md` phases 1-3 having landed.

**4 — Activities and targets server side.** `activities`, `weekActivities`,
`notes`, `links` and settings move onto the engine. Events stay in the calendar
throughout. This is what makes a second device show the same targets, not just
the same workouts.

**5 — Strava.** First pull-only connector. Exercises `policy` (two-week window,
rate limits) and source precedence. Adds the activity link on the event per
`_todo/integration-strava.md`.

**6 — Garmin.** Recorded activities plus recommendations. Recommendations are a
new entity kind — suggestions, not events — that the user drags into the plan;
they need their own table but ride the same engine.

**7 — Sheets.** Move export server side so it can run scheduled, not only when
the modal is open.

---

## Open questions

- **Scheduled pulls** — do Strava/Garmin refresh on a cron, or only when the app
  is open? Cron is nicer but means storing third-party refresh tokens server
  side, which is a meaningfully larger security surface than the current
  JWT-only design in `lib/auth.ts`. **Still open.** Phase 1 deliberately left
  Strava's tokens in their encrypted cookie (`lib/stravaServer.ts`) even though
  there is now a table to put them in, so the server continues to hold no
  third-party credentials at rest. `accounts` stores the athlete id only.
- **Realtime** — a second open tab is currently invisible. Polling on focus is
  probably enough; skip websockets until someone asks.
- **History** — it is event-shaped but Google has no notion of "done". Either it
  stays a database table (the assumption above) or completed events get a
  `workoutDone` private property and history is derived from the calendar. The
  table is the safer call; decide before phase 4.
- **Multiple plans** — Griley's two-calendar case (`_todo/griley-ideas.md`,
  training for a half and a tri at once) suggests a `plans` table above
  `activities`, plus a calendar per plan rather than one `Workouts` calendar.
  **Partly settled:** `activities.plan_id` exists, is nullable and is read by
  nothing, so the expensive half — retrofitting a column onto a populated table
  — is already paid for. The `plans` table and a calendar per plan are still
  undecided.
