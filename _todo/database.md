# Adding a database

Right now the plan lives in `localStorage` (`usePlannerStore` + `persist`) and,
if the user connects it, is mirrored into a `Workouts` Google calendar by
`hooks/useCalendarSync.ts`. That was a deliberate "no database" call — see
`_todo/done/2026-08-12-integration-google-continued.md`. It holds up for one
person on one device. It stops holding up as soon as we add:

- a second device (nothing merges; last pull wins whatever it finds),
- goals (they are local-only, so an event for an unknown goal is silently
  skipped),
- Strava (`_todo/integration-strava.md`) and Garmin
  (`_todo/integration-garmin.md`), which are _readers_ that write back into the
  same items the calendar is also writing.

That last point is the real reason to do this now. With three writers and one
reader per item, ad-hoc syncing in each hook does not scale — `useCalendarSync`
already carries a hand-rolled baseline map, a debounce, a ready flag and an
in-flight guard, and each new integration would grow its own copy of that.

**This document is about building the sync infrastructure first**, then moving
the calendar onto it, then plugging in the rest.

---

## Principles

1. **Local-first stays.** The app must work signed out and offline, exactly as
   it does today. The database is a replica, never a prerequisite for render.
2. **One sync engine, many connectors.** Debounce, batching, retry, status and
   conflict resolution live in one place. A connector only says how to read and
   write one remote.
3. **The database is the hub.** Google Calendar, Strava and Garmin sync against
   our rows, not against each other and not against the browser. Two connectors
   never talk.
4. **Writes are batched and debounced.** A user dragging a workout through the
   day produces one write, not forty. Target: no more than one round trip per
   entity per ~1.5s of continuous editing.
5. **Every write is explainable to the user.** There is always an honest answer
   to "is my stuff saved?" — see [Sync visibility](#sync-visibility).

---

## Data model

Five tables. Ids stay client-generated (they already are), so an offline edit
keeps its identity when it lands.

| Table            | Notes                                                             |
| ---------------- | ----------------------------------------------------------------- |
| `users`          | Google `sub` as the external id, plus settings currently in the store (`weekStartsOn`, `tempUnit`, `defaultStartMinutes`, `googleCalendarId`, `googleSheetId`). |
| `goals`          | `WorkoutTypeSchema`, per user. Today these are local-only — moving them server side is the single biggest win. |
| `items`          | `CalendarItemSchema`, per user. Indexed on `(userId, weekStart)` because every query is a week window. |
| `notes`          | `(userId, weekStart, day) -> text`. |
| `history`        | `HistoryEntrySchema`. Append-mostly; this is what Sheets export reads. |

Every synced row carries, in addition to its domain fields:

```ts
revision: number;      // server-incremented, monotonic per row
updatedAt: string;     // ISO, last edit to the *content*
deletedAt: string|null;// soft delete — a tombstone, so deletes propagate
source: 'local' | 'google' | 'strava' | 'garmin';  // who last wrote it
externalIds: { google?: string; strava?: string; garmin?: string };
```

`updatedAt` and the "bookkeeping does not bump it" rule already exist on
`CalendarItem` and are load-bearing — keep that comment's intent. `revision` is
new and is what makes an incremental pull possible: the client asks for
`revision > lastSeen` instead of re-reading a 20-week window every load.

Tombstones need a sweep — delete rows whose `deletedAt` is older than, say, 90
days, well past any plausible offline window.

### Zod

`lib/types.ts` schemas stay the wire contract. Add a `SyncMetaSchema` and
compose: `const SyncedItemSchema = CalendarItemSchema.extend(SyncMeta)`. The
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
                                  (authoritative)     connector             connectors
                                                                             (pull-only)
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
  entity: 'goal' | 'item' | 'note' | 'history' | 'settings';
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

- **Debounce 1200ms** on the trailing edge (matching today's
  `PUSH_DEBOUNCE_MS`), with a **5s max wait** so a long continuous drag still
  checkpoints instead of holding everything until the user stops.
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
database. Upload local state as the initial revision, then pull. Where the
calendar already holds events, match on `googleEventId` — items already carry it
— so a user who has been syncing to Google does not get doubles.

Keep `localStorage` as the offline cache afterwards; it stops being the source
of truth but stays the thing that makes a cold load instant.

Signed-out users are untouched: no `userId`, no engine, the app as it is today.

---

## Phases

Each phase ships on its own and leaves the app working.

**1 — Schema and API.** Tables, Drizzle migrations, `revision`/`updatedAt`/
`deletedAt`/`source` metadata, `/api/sync` GET delta + POST batch (transactional,
idempotent on change id). No client changes; tested against the API directly.

**2 — Engine and outbox.** `lib/sync/*`, the db connector, the migration path,
the header indicator. At the end of this phase the plan persists to Postgres and
survives a device switch. Google sync is untouched and still runs its old path.

**3 — Calendar onto the engine.** Rewrite `useCalendarSync` as a connector.
Delete the bespoke baseline map, debounce and ready flag; the engine owns them.
Move the pull server side. This is the proof the abstraction is right — if the
calendar does not fit cleanly, fix the engine before phase 4.

**4 — Goals server side.** Removes the "an event for a goal this device does not
have is skipped" limitation, which is the sharpest edge in the current design.

**5 — Strava.** First pull-only connector. Exercises `policy` (two-week window,
rate limits) and source precedence. Adds the activity link on the event per
`_todo/integration-strava.md`.

**6 — Garmin.** Recorded activities plus recommendations. Recommendations are a
new entity kind — suggestions, not items — that the user drags into the plan;
they need their own table but ride the same engine.

**7 — Sheets.** Move export server side so it can run scheduled, not only when
the modal is open.

---

## Open questions

- **Scheduled pulls** — do Strava/Garmin refresh on a cron, or only when the app
  is open? Cron is nicer but means storing third-party refresh tokens server
  side, which is a meaningfully larger security surface than the current
  JWT-only design in `lib/auth.ts`.
- **Realtime** — a second open tab is currently invisible. Polling on focus is
  probably enough; skip websockets until someone asks.
- **Multiple plans** — Griley's two-calendar case (`_todo/griley-ideas.md`,
  training for a half and a tri at once) suggests a `plans` table above `goals`
  and `items`. Cheap to add now as a nullable `planId`, expensive to retrofit.
  Worth deciding before phase 1 lands.
