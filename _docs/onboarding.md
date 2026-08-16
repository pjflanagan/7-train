# Signing in, scopes and the calendar

## There is one question, and it is "sign in with Google?"

That is the whole flow. Everything that used to be asked afterwards is now
decided:

- **Which calendar?** Not asked. The account has one; it is made without asking.
- **Connect calendar sync?** Not asked. It comes with signing in.
- **Where do events go?** The `Workouts` calendar, always.

`signInWithGoogle()` is a thin alias for
`connectGoogleIntegration(GOOGLE_INTEGRATIONS.calendar, …)`, and that is not an
oversight. Calendar sync is the reason to have an account here at all — someone
signed in whose plan still only lives in one browser has none of what they
signed in for. One consent screen covers identity and calendar together.

There is deliberately **no base-scopes-only sign-in path**. It had no callers
left once the calendar moved into sign-up, and reviving it would put people back
in the state where they have an account and no calendar.

## Scopes

Incremental by design: nobody is asked for a scope until they have said they
want what it is for.

| Scope | When | Why this one |
| --- | --- | --- |
| `openid email profile` | Always | Identity |
| `calendar.app.created` | At sign-in | Reaches **only** calendars this app made. We cannot see the rest of a user's calendar |
| `drive.file` | When Sheets export is connected | Per-file consent. We can create and keep editing our sheet, and see nothing else in Drive |

Google drops previously granted scopes unless they are re-requested, so
`scopeRequestFor()` always asks for everything already held.

Strava is **not** a NextAuth provider. It has its own small OAuth flow, so that
connecting Strava neither requires a Google account nor can replace the identity
the rest of the app is built on.

## How the calendar gets made

`useEnsureCalendar` creates it, once, silently — and only after
`useUserSettled()`. That gate is the entire point: creating before the settings
pull lands rebuilds the duplicate-calendar bug the pull exists to prevent. See
[sync.md](sync.md).

The attempt is not retried within a page load, even on failure. A failed create
that reset its own guard would be retried on the next render, and a create
failing slowly would make one calendar per render once it started succeeding.

## Deployment states

Both are read **server side** and handed to the client through one context, so
the UI knows on its first render rather than after a round trip:

- **No Google credentials** — sign-in is not offered. `/api/auth/session` can
  only 500, so the session provider is skipped entirely and the hooks get a
  settled signed-out value.
- **No Strava credentials** — the Strava section does not render.

## What a signed-in user can still not do

- Choose or change which calendar the plan lives in.
- Sync week targets, notes or links to another device — those are still local.
- Have anything sync while no browser is open.

## How this is enforced

- `__tests__/google.test.ts` — scope requests keep previously granted scopes.
- `__tests__/stravaGate.test.ts` — the signed-out and still-loading cases are
  different answers, and only one of them means "nothing is coming".
