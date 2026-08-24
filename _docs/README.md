# _docs — defined behaviour

What this app is **decided** to do, and why. Not a tour of the code, and not a
plan: `_todo/` holds what is proposed, `_docs/` holds what is settled.

Read these before changing anything they cover. Most of the rules here exist
because the obvious alternative was tried and broke something — usually
silently, and usually only for people with two devices.

| Doc | Covers |
| --- | --- |
| [sync.md](sync.md) | The order integrations run in, what gates them, and the API budgets |
| [storage.md](storage.md) | Which store owns what, why the browser owns nothing, and what survives a wipe |
| [onboarding.md](onboarding.md) | Signing in, scopes, and how the calendar gets made |
| [copy.md](copy.md) | Where user-facing text lives and the casing rule |

## The one rule under all of them

**The backend is the plan.** Nothing is cached in the browser: the store starts
empty on every load, and what is on screen was fetched — settings and activities
from Postgres, the schedule from Google Calendar. A plan that outlives the
session it belongs to is a bug, not a feature.

This replaced the opposite rule, and the reversal was the point. "Local-first is
not negotiable" made `localStorage` the source of truth and the two remote
stores its replicas, which meant a sign out left the plan on screen for the next
person and the next sign in pushed it up as theirs. See
[storage.md](storage.md) for what that cost and what this one costs instead —
mainly that there is no usable signed-out or offline mode any more.

What survives from the old rule: **no failed sync may lose or block an edit**,
and every gate settles on failure as well as on success, so a broken pull leaves
a usable app rather than a spinner.

Each doc ends with a "how this is enforced" section pointing at the tests that
hold it in place. If you change behaviour a doc describes, change the doc and
the test in the same commit.
