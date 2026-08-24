# Get rid of local storage

> **Status: done.** The plan is no longer cached in the browser at all. The
> defined behaviour now lives in `_docs/storage.md`; this file is the record of
> why it changed.

The original note, in full:

> when a user logs out, they should not see thier data anymore. maybe we need to
> fully get rid of local storage

That "maybe" turned out to be the whole answer. Logging out was one symptom of
the same thing: `localStorage['workout-week']` was the source of truth, and the
two real stores — Google Calendar and Postgres — were replicas of a copy that
belonged to a *browser* rather than to a person.

## What that cost

- **A sign out did not sign the plan out.** The store outlived the session, so
  the next person at a shared machine saw the last one's week.
- **The next sign in pushed it up as theirs.** A browser holding a plan was, by
  design, the winner of the first sync (`mergeOnFirstPull`, `remote.isNew`), so
  one account's activities could become another's.
- **Everything was gated on hydration.** `usePlannerHydrated()` stood in front
  of all four sync hooks and the page itself, because before `localStorage` was
  read the store answered with seeded sample data — and uploading *that* as
  someone's plan was a live bug the gate existed to prevent.

## What replaced it

- `usePlannerStore` is a plain zustand store. No `persist`, no `migrate`, no
  `onRehydrateStorage`. It starts blank on every load.
- `usePlannerLoaded()` replaces `usePlannerHydrated()`: the same question asked
  of the backend instead of the browser, holding the planner's spinner until the
  settings pull and the calendar pull have landed — or until it is settled that
  neither is coming.
- `useSignedOutReset()` empties the store when the session goes away, because a
  sign out is not a page load.
- The sample plan is no longer what a fresh browser starts with. It is what a
  brand new *account* starts from: `useUserSync` writes it once, when the server
  says `isNew`, and pushes it up as the first revision.
- `importLegacy()` went with the storage it read. `migrateStore` stayed —
  backup files can still be old.

## What it cost in turn

- **No usable signed-out or offline mode.** Signed out there is nothing to
  fetch, the week is empty, and an edit lasts until the tab closes. This was
  "local-first is not negotiable" in `_docs/README.md`; that rule is now
  reversed on purpose.
- **Day notes and helpful links have nowhere to live.** Neither ever had a
  backend, and the cache was what made them look persistent. They are now
  in-memory for the life of the tab. Week targets are unaffected — Google
  Calendar holds those next to the events.

The second one is the piece of work this change makes necessary. Notes and
links want the same treatment activities got: a table, a route, and a place in
`useUserSync`.
