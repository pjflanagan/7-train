# _docs — defined behaviour

What this app is **decided** to do, and why. Not a tour of the code, and not a
plan: `_todo/` holds what is proposed, `_docs/` holds what is settled.

Read these before changing anything they cover. Most of the rules here exist
because the obvious alternative was tried and broke something — usually
silently, and usually only for people with two devices.

| Doc | Covers |
| --- | --- |
| [sync.md](sync.md) | The order integrations run in, what gates them, and the API budgets |
| [storage.md](storage.md) | Which of the three stores owns what, and what survives a wipe |
| [onboarding.md](onboarding.md) | Signing in, scopes, and how the calendar gets made |
| [copy.md](copy.md) | Where user-facing text lives and the casing rule |

## The one rule under all of them

**Local-first is not negotiable.** Signed out, offline, with no database and no
Google credentials, the planner draws the week from `localStorage` and every
edit works. Google Calendar and the database are replicas. Nothing in the render
path may wait on a network call, and no failed sync may lose or block an edit.

Each doc ends with a "how this is enforced" section pointing at the tests that
hold it in place. If you change behaviour a doc describes, change the doc and
the test in the same commit.
