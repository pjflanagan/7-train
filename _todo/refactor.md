# Refactor: copy, sync, and onboarding

A survey after the Strava and database work. Nothing here is a bug report about
behaviour users see today — the app works. It is about the three places where
the same decision is now made in several spots, and where the next feature will
have to make it a fourth time.

Ordered by payoff. Each section is independent; none of them need each other.

---

## 1. Copy lives in three places, and the rules only hold in one

`AGENTS.md` has a rule — sentence case, never title case — and there is nowhere
to enforce it, because there is no single place copy goes through. Right now a
user-facing string is in one of three states:

**In a constant, near its meaning.** `GOOGLE_INTEGRATIONS[].label` and
`.description` in `lib/google.ts`, `STRAVA_SPORTS` labels in
`lib/stravaSports.ts`, `SITE_NAME`/`SITE_DESCRIPTION` in `lib/site.ts`. This is
the good shape: the string sits with the thing it names, and there is one of it.

**In an ad-hoc map at the top of the file that renders it.** `STRAVA_LABEL` in
`IntegrationsModal.tsx`, `MESSAGES` in `useStravaConnectOutcome.ts`,
`GROUP_LABELS` in `StravaSportPicker.tsx`, `getConfirmDetails()` in
`SettingsModal.tsx`. Same idea as the above, invented separately four times, with
four different names and no shared type.

**Inline in JSX.** Most of it. `SyncIndicator.tsx` has five states' worth of
copy inline, including two `title=` strings that restate the visible label in
different words. The Strava section of `IntegrationsModal` has a 30-word
paragraph inline.

### What this has already cost

These are real, found while surveying — not hypotheticals:

- `lib/constants.ts:154` seeds an event with `workoutType: 'Long run'`, but the
  seeded Run activity's `workoutTypes` is `['Long', 'Tempo']`. The seed
  references a workout type that does not exist on its own activity. Two lists
  of the same strings, 110 lines apart.
- `placeholder="e.g. Long Run, Recovery"` and `placeholder="e.g. Running,
  Lifting"` in the activity form are title case, against the rule.
- `title="My weekly activities"` on the header button opens a modal titled
  "My activities". The domain vocabulary section of `AGENTS.md` fixed the second
  one and missed the first.
- `DEFAULT_LINKS` ships `'Gym Pool Schedule'` — title case, and a placeholder
  someone's real install is stuck with.

Every one of these is the same failure: a string with no single home, so a
rename reached some copies and not others. The `goals` → `targets` rename is the
proof of how expensive that gets.

### What to do

**Not** an i18n framework. There is one language and the ceremony would cost
more than it saves.

Instead: `lib/copy.ts`, a plain nested object of strings, and a rule that
user-facing text is imported from it rather than typed into JSX. The wins are
specific:

- A rename is one file. `goals` → `targets` would have been a diff you could
  read in one screen.
- The status-label maps get one shape. `STRAVA_LABEL`, `MESSAGES` and the
  calendar states in `SyncIndicator` are all `Record<Status, string>`; typing
  them as such makes a missing state a compile error instead of a blank span.
  `STRAVA_LABEL` is currently `Record<string, string>`, which type-checks a
  typo'd key perfectly happily.
- One place to lint. A test that walks the object and asserts no value matches
  `/\b[A-Z][a-z]+ [A-Z][a-z]+/` outside a proper-noun allowlist enforces the
  sentence-case rule mechanically. Today it is enforced by remembering.

Scope it to text a user reads. Server-side `error:` strings in `app/api/` should
stay put — they are diagnostics, they are read by the code that handles them,
and hoisting them separates a message from the branch that explains it.

Do the seed-data fix and the title-case fixes as part of this, not before it.

---

## 2. Three hand-rolled sync loops

`useCalendarSync` (598 lines), `useUserSync` (250) and `useStravaSync` each
independently implement: a ready flag, an in-flight guard, a debounce, a
cancellation token, a status enum in a companion zustand store, and a
"signature" comparison to skip an unchanged push. `_todo/database.md` already
flags this; the survey confirms three is where it stops being a coincidence.

The tell is that each one's *status store* is a near-copy:
`useCalendarSyncStatus.ts` and `useStravaStatus.ts` are the same file with
different enum members, and `useUserSync` inlines a third. All three carry a
`resyncNonce` counter incremented to ask the loop to run again.

Worse, the ordering between them is expressed as one hook reading another's
status: `useStravaSync` waits on `calendarStatus === 'off' || 'synced'`,
`useEnsureCalendar` waits on `useUserSettled()`. That is a dependency graph
written as three separate conditionals. Adding Garmin
(`_todo/integration-garmin.md`) means a fourth loop that has to know about the
first three.

### What to do

Extract the loop, not the domain. Something like `createSyncLoop({ pull, push,
dependsOn })` that owns the debounce, guards, nonce and status store, and lets
each integration supply only its three functions. `PlannerPage` then declares
the order once instead of each hook inferring it.

This is the biggest single reduction available — several hundred lines — but it
is also the one most able to break sync in ways tests will not catch. Do it
after §1, and only with the calendar loop's existing behaviour pinned by tests
first.

---

## 3. Onboarding and login are simpler than the code remembers

The calendar-choice removal left the shape behind.

**`signInWithGoogle` is now a lie of a name.** It is
`connectGoogleIntegration(GOOGLE_INTEGRATIONS.calendar, ...)` — signing in *is*
connecting the calendar, and has been since the modal rework. The
`GOOGLE_BASE_SCOPES`-only path it was named for no longer has a caller. Either
rename it to say what it does, or drop it and call
`connectGoogleIntegration` directly.

**The "calendar not connected" branch in `IntegrationsModal` is dead for
everyone new.** Its own comment says so: "Only reachable for an account that
signed in before the calendar came with it." That was true for a window of days.
It is 20 lines of JSX plus a `Connect` button maintained for a population that
may be one person. Worth deciding deliberately: keep it with a date on the
comment, or delete it and let those accounts re-consent through `needsReauth`,
which already exists and already handles exactly this.

**Two hydration hooks.** `useHydrated` (a `setTimeout(0)` that means "we are on
the client now") and `usePlannerHydrated` (a real `useSyncExternalStore` on the
persist middleware). `PlannerPage` uses `useHydrated() &&
usePlannerStore.persist.hasHydrated()` — which is the second hook, open-coded,
next to the first. The `hasHydrated()` call there is the exact non-subscribing
read that `usePlannerHydrated`'s doc comment warns against. It happens to work
because `useHydrated` re-renders it. Collapse to one hook.

**`isGoogleAuthConfigured` and `strava.isConfigured` are the same concept
delivered two different ways** — one through React context from a server
component, one through a client fetch to `/api/strava/status` that also returns
connection state. The Strava one means the modal cannot know whether to show the
section until a round trip finishes. Moving it into the same server-rendered
context would remove a fetch and a loading state.

---

## 4. Smaller, mechanical

- **`SettingsModal.tsx`** (240 lines) mixes tab state, confirm-dialog state,
  file import, and four tabs of markup. The confirm copy in `getConfirmDetails`
  is three near-identical destructive warnings that could be one component
  taking a noun.
- **`WORKOUTS_CALENDAR_SUMMARY = 'Workouts'`** is a constant, but "your Workouts
  calendar" is written out in four toast strings. Folds into §1.
- **`app/api/` error responses** repeat `{ error: '... is not connected' }` and
  the `catch` → `error.message` → 500 ladder in five routes. One
  `apiError(error, fallback)` helper would cover all of them.
- **`lib/constants.ts`** holds seed data, the day list *and* the colour palette.
  The day list is imported by `lib/dates.ts` for the sole reason that
  `constants` must not import `dates` — a cycle worked around by putting the
  days in the wrong file. Splitting seeds out into `lib/seed.ts` lets `DAYS`
  live somewhere honest.

---

## Suggested order

1. §1 copy — highest ratio of clarity to risk, and it fixes four live
   inconsistencies on the way.
2. §3 onboarding — small, isolated, mostly deletion.
3. §4 mechanical — pick up opportunistically.
4. §2 sync — largest win, largest risk. Wants tests around `useCalendarSync`
   before it starts, and is the natural moment to do that anyway.

§2 is also the one to do *before* Garmin, not after.
