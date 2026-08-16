# User-facing text

## Sentence case, always

Capitalise the first word and proper nouns. Nothing else.

> "My activities", not "My Activities". "Add activity", not "Add Activity".
> "Weekly target", not "Weekly Target".

Acronyms keep their capitals ("Export CSV", "URL"), as do proper nouns ("Google
Calendar", "Strava", "New York").

This rule is in `AGENTS.md` and used to be enforced by remembering, which is to
say not enforced. `__tests__/copy.test.ts` walks `lib/copy.ts` and fails on a
capitalised word that is neither sentence-initial nor a known proper noun.

Buttons, headings and placeholders do not end in a full stop; sentences do. That
is also checked.

## Text lives in `lib/copy.ts`

Not an i18n layer — there is one language and a framework would cost more than
it saves. It exists for three things that had each already gone wrong:

**Renames reach every copy.** The `goals` → `targets` rename had to find every
string by hand and missed some. The header button said "My weekly activities",
the modal it opened said "My activities", and a Strava toast named a third
variant. One `MY_ACTIVITIES` constant now feeds all of them.

**Status maps are exhaustive.** Label maps used to be `Record<string, string>`
declared at the top of whichever component rendered them, so a typo'd key
type-checked happily and rendered a blank span. They are now keyed by their
status union (`satisfies Record<CalendarSyncStatus, string>`), so a new state
cannot be added without its label.

**There is one place to lint.**

## What does not go in it

**Server-side `error:` strings in `app/api/`.** They are diagnostics read by the
code handling the response, not text shown in place of a label, and separating
them from the branch that raises them makes both harder to follow. `lib/apiError.ts`
holds the shared *shape* of an error reply, not a copy table.

**Anything generated from data** — activity names, workout types, calendar
names. Those are the user's words, not ours.

## The domain vocabulary

These words are the product. Use them in code, types, styles and UI alike; the
old ones are gone.

| Word | Means | Never |
| --- | --- | --- |
| **Activity** | Something the user can do, e.g. Running. Managed in "My activities" | "goal", "workout type" |
| **Workout type** | A sub-kind of one activity, e.g. "Long run" | — |
| **Target** | How much of an activity a week aims at | "weekly goal" |
| **Event** | One scheduled session on the calendar, hitting a target | "item" |

Persisted keys are `activities` and `events`. `goals` and `items` are the pre-v3
names and appear only inside `migrateStore`.

## Seed data counts as copy

`lib/seed.ts` ships a first week, and its strings are read by real users. They
follow the same casing rule, and a seeded event may only name a workout type its
own activity actually has — the two lists had drifted, so
`__tests__/copy.test.ts` checks it.

## How this is enforced

`__tests__/copy.test.ts` — sentence case, trailing full stops, and seed-data
consistency. Adding a proper noun means adding it to `PROPER_NOUNS` there, which
is the point: it should take a deliberate act.
