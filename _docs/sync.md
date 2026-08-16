# Sync: order, gates and budgets

Three integrations write into the same plan. They are not independent, and the
order is load-bearing.

```
useUserSync        settings + activities, from our database
      ↓  useUserSettled()
useEnsureCalendar  makes the Workouts calendar if the account has none
      ↓  googleCalendarId
useCalendarSync    the schedule, from Google Calendar   ← owns what was planned
      ↓  useCalendarSettled()
useStravaSync      recordings, from Strava              ← owns what was done
```

All four are mounted once, at the top of `PlannerPage`. Mounting any of them
twice means running it twice.

## Why this order

**Settings before calendar.** `googleCalendarId` is the only thread back to a
user's calendar. It lives on the `users` row, keyed by Google `sub`, and a
browser that has not read it yet is *not* a browser without a calendar — it is a
browser that does not know yet. Creating one on a missing id is how the app once
made a second `Workouts` calendar for every private window and cleared cache,
splitting the plan across both permanently.

**Calendar before Strava.** Google Calendar is the source of truth for what was
*planned*. A Strava read that beats the pull matches recordings against whatever
was in `localStorage`, and adds duplicate events for the workouts the pull was
about to bring in. Since Strava is read once per load, that damage is not
self-correcting.

## The gates

Each gate answers "could the thing above me still change what I am about to act
on?" — and each has to distinguish **"no"** from **"not yet"**.

| Gate | True when |
| --- | --- |
| `useUserSettled()` | The settings pull returned, *or* it is settled there will never be one (signed out, no `DATABASE_URL`) |
| `useCalendarSettled()` | The first calendar pull returned, *or* no calendar is coming |

Both go true on **failure** as well as success. A failed pull is an answer: the
data is not arriving on this page load, and blocking forever would turn one
broken integration into two.

### Do not gate on a status enum

`useCalendarSettled` used to be `status === 'off' || status === 'synced'`, and
that was a bug rather than a shortcut:

- `'off'` is the store's **initial** value, so the gate was true on the first
  render, before the calendar had said anything. Strava read immediately, and
  the once-per-load guard then ensured it never re-read against the real
  schedule.
- `'synced'` is also set after every *push*, so it never implied a pull had
  happened at all.

A status enum describes what a loop is doing **now**. Settledness is a fact
about what has already happened, and needs its own one-way flag (`hasPulled`).
New integrations must follow the same shape.

There is one more case a naive gate misses: a signed-in user with no
`googleCalendarId` may be seconds away from having one, because
`useEnsureCalendar` is mid-create. `hasResolvedCalendar` covers that window, and
is set in the `finally` of the create so a failure resolves it too.

## API budgets

**Strava: one read per page load.** The limit is 100 reads per fifteen minutes
*for the whole app*, not per user, so it is a shared resource that a busy day
can exhaust for everybody. `useStravaSync` reads once per `resyncNonce`; the
nonce starts at 0 and only the "sync now" button moves it. The plan being
edited, the calendar re-settling, or the component re-rendering must never buy
another read.

The connection ref is deliberately **not** cleared when the connection drops:
connecting Strava is a full-page navigation through its consent screen, so a
genuine reconnect arrives with a fresh ref anyway, and clearing it could only
let a flicker in connection state spend a read.

**Google Calendar: pull on load, push debounced.** One pull per load or per
press of the header indicator, covering 8 weeks back and 12 forward. Writes are
debounced by `SYNC_DEBOUNCE_MS` (5s) so a run of edits is one write. Nothing
polls Google — a workout moved in Google Calendar arrives when someone asks.

**Our own database: pull on load, push debounced (2s), and only on change.**
Signatures of settings and activities are compared against what the server said
it holds, so an unchanged push is never sent.

## Consequences worth knowing

- **Two open tabs do not live-update each other.** A change in one reaches the
  other on its next load.
- **A failed calendar pull still lets Strava read**, against a schedule that may
  be stale. This is the deliberate cost of "once per load"; the alternative is
  disabling Strava whenever Google has a bad minute.
- **Adding a fourth integration** (Garmin is sketched in
  `_todo/integration-garmin.md`) means a fourth hand-rolled loop. See §2 of
  `_todo/refactor.md` — the loops should become one engine before that happens,
  not after.

## How this is enforced

- `__tests__/stravaGate.test.ts` — every state of `useCalendarSettled`,
  including the first-render case that regressed.
- `__tests__/calendarAdoption.test.ts` — the upload-then-pull order, and that a
  never-uploaded week is not overwritten by a pull.
- `__tests__/calendarWire.test.ts`, `__tests__/updatedAt.test.ts` — the wire
  format and which side of a merge wins.
- `__tests__/strava.test.ts` — matching recordings to planned events.
