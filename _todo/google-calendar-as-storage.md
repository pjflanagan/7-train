# Google Calendar as event storage

The goal: **Google Calendar is where events live.** If we ever add a database it
holds user settings and "My activities" — the things a calendar event has no
place for — and nothing else. A device that signs in with an empty
`localStorage` must be able to pull the calendar and draw the whole plan,
including weeks it has no targets for.

Two things stood in the way.

## Where we actually are

1. ~~**Events do not fully describe themselves locally.**~~ **Fixed.** An event
   used to resolve its activity out of its week's targets and only kept a copy
   of its own once the week stopped aiming at it, so an event in a week with no
   target drew nothing. Every event now carries `activitySnapshot` from the
   moment it is created, and `resolveEventActivity` answers with no week around
   it. Phase 1 below.
2. **The wire carries almost nothing.** A Google event's private properties are
   `workoutItemId`, `workoutTypeId`, `workoutSubType`, `workoutValue`
   (`lib/googleCalendar.ts`). No name, icon, color, unit, metric. So
   `useCalendarSync` has to skip any pulled event whose activity is unknown in
   its week — the `if (!knownInWeek(event) && !activitySnapshot) continue` line.
   That skip is the bug this document deletes.

## The change

**An event always carries `activitySnapshot`.** It stops being a tombstone for
deleted activities and becomes the event's own copy of what it is — written at
create time, refreshed whenever the event is edited while its week's activity
still matches, frozen the moment the activity stops describing it (deleted, or
re-measured). The existing "snapshot wins over live" rule in
`resolveEventActivity` is already correct; it simply stops being the exception.

### 1. Schema (`lib/types.ts`) — **done**

- `ActivitySnapshotSchema` gains `workoutTypes: z.array(z.string()).optional()`
  — a pulled event should be able to offer its sub-kinds without the activity
  existing locally. `activityFromSnapshot` prefers `live?.workoutTypes` and
  falls back to the snapshot's.
- `ScheduledEvent.activitySnapshot` is written on every event. It stays
  `.optional()` in the schema so pre-migration data parses, and "missing" still
  means "resolve from the week".
- New: `ScheduledEvent.activityFrozen`. The snapshot used to double as the
  frozen flag — its presence meant "the week stopped describing this". Now that
  every event has one, the flag has to be explicit: frozen events read off the
  snapshot, tracking ones prefer the live activity and are re-stamped on edit.

### 2. Migration (`lib/migrate.ts`) — **done** (v9)

`migrateV8toV9`: every event without a snapshot gets one from its week's
activity (`weekActivities[weekStart:typeId]`), else from `activities`, else a
frozen placeholder ("Workout", `instance`, `sessions`, neutral color, `other`
icon). No event comes out of the migration snapshot-less.

An event that *already* held a snapshot held it because it was frozen, but the
old data does not say so. It is read back off the snapshot: frozen exactly when
there is nothing to compare against any more, or when the metric or unit
disagree with the week's activity (the two old freeze reasons). Anything else
was a copy that should have been tracking, so it is refreshed instead — which
also keeps a re-imported backup from freezing the whole plan.

### 3. Store (`lib/store.ts`) — **done**

- `addEvent` stamps `snapshotFor(state, weekStart, typeId)` — the week's copy of
  the activity, falling back to the template in "My activities".
- `getDefaultEvents` stamps the seeds the same way, so even a first run has no
  event leaning on its week.
- `updateWeekActivity` re-stamps that week's tracking events on any edit that
  still describes them (name, colour, icon, pace) — otherwise renaming "Running"
  leaves last Tuesday reading the old name. A re-measure (metric or unit) still
  freezes instead, holding the activity as it was.
- `removeWeekActivity` freezes rather than merely snapshotting, so re-adding a
  differently shaped activity under the same id later cannot reach back into
  what was already scheduled.
- `nextFreeSlot` / `endOf` estimate a workout's length through
  `resolveEventActivity` rather than off `state.activities`, so stacking works in
  a week with no targets too.

### 4. Wire format (`lib/googleCalendar.ts`)

One new private property alongside the existing four:

```
PROP_SNAPSHOT = 'workoutActivity'   // JSON.stringify(ActivitySnapshot)
PROP_WEEK_START = 'workoutWeekStart' // YYYY-MM-DD
```

- The snapshot is JSON in a single property. Google's limit is 1024 bytes per
  private property value and ~32KB total per event; a snapshot is comfortably
  under 300 bytes. Parse defensively — `ActivitySnapshotSchema.safeParse`, and
  on failure fall back to today's resolve-from-week path rather than dropping
  the event.
- `weekStart` goes on the wire because the browser currently *derives* it from
  the start instant and its own `weekStartsOn`. Two devices with different week
  starts would otherwise disagree about which week an event belongs to. On pull,
  prefer the stored `weekStart` when it is consistent with the local
  `weekStartsOn`; recompute when it is not (the user changed the setting).
- `itemPropsFromEvent` and `PulledEvent` grow the two fields.

### 5. Sync (`hooks/useCalendarSync.ts`)

- Delete the `knownInWeek` skip. Every pulled event with a parsable snapshot is
  kept and rendered.
- `eventFromGoogle` sets `activitySnapshot` from the wire, preferring a local
  snapshot only when the pulled one is missing. (Until then it carries the local
  event's snapshot and `activityFrozen` across the pull, so syncing does not
  strip an event of its copy.)
- `eventSignature` includes the snapshot (serialized) so a renamed activity
  actually pushes.
- `draftFor` reads `activity.name` / `unit` off the resolved activity, which now
  works snapshot-only — so the push loop's `if (!activity) continue` becomes
  unreachable and can go.

### 6. Rendering — **done**

No component changes needed — everything already goes through
`useEventActivity` / `resolveEventActivity`. `__tests__/eventSelfDescribes.test.ts` covers it: an event resolves a full
activity out of an otherwise **empty** store (no `activities`, no
`weekActivities`).

What still needs targets: the target strip and progress rings. That is correct —
a target *is* a user setting. A week pulled from the calendar with no targets
shows its events and an empty target strip, and that is the intended state.

## Phases

1. **Snapshot everywhere** — ✅ **done**. Schema, migration (v9), store
   stamping, seed events, and `__tests__/eventSelfDescribes.test.ts`. Purely
   local; no calendar change. An event now renders in a week with no targets.
2. **Snapshot on the wire** — the two new private properties, write + read +
   defensive parse. Backward compatible: an event written by an older client
   just has no snapshot property and takes the old path.
3. **Drop the skip** — remove `knownInWeek`, add the empty-store pull test. This
   is the phase where calendar-as-storage is actually true.
4. **Empty-store bootstrap** — on sign-in with no local plan, pull the window
   before first render rather than after, so the user does not watch an empty
   week fill in.

## What the calendar still cannot hold

These stay local (and are what a future database would be *for*):

- `activities` — "My activities", the template.
- `weekActivities` — per-week targets.
- `notes`, `links`, `history`.
- Settings: `weekStartsOn`, `tempUnit`, `use24HourClock`, `defaultStartMinutes`,
  `googleCalendarId`, `googleSheetId`.

`history` is the awkward one: it is event-shaped but describes the past, and
Google has no notion of "done". Either keep it local, or give completed events a
`workoutDone` private property and derive history from the calendar. Decide
before phase 4 — see the open question in `_todo/database.md`.
