# 7 Train

A sleek, responsive, local-first workout planner built for maximum usability and
zero loading screens.

Plan a week of activities, hit your targets, and — optionally — keep the whole
thing in your own Google Calendar with what you actually did read back from
Strava.

## Running locally

```bash
npm install
npm run dev
```

Then visit `http://localhost:3000`. Nothing below is required to run it.

```bash
npm test          # vitest
npm run build     # next build
```

## Architecture

Next.js (App Router) in TypeScript.

- **Next.js** for the app framework and API routes
- **Zustand** (with `persist`) for local-first state
- **Zod** for schema validation at every boundary
- **@dnd-kit** for accessible, touch-friendly drag and drop
- **SCSS Modules** for scoped styling — [no Tailwind](AGENTS.md)
- **Drizzle** + Neon Postgres for settings, when configured

### Local-first, precisely

The plan lives in `localStorage` and the render path reads only that. Signed
out, offline, with no database and no credentials, every feature that does not
name a third party works. Google Calendar and Postgres are replicas, never
prerequisites.

## Optional integrations

Each is dormant until its environment variables are set, and hidden rather than
offered-and-broken when they are not. See `.env.example`.

| Integration | Turns on with | Gives you |
| --- | --- | --- |
| **Google sign in** | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET` | An account, and calendar sync with it |
| **Google Calendar** | (comes with sign in) | The plan in your own `Workouts` calendar, editable from anywhere |
| **Google Sheets** | (granted on request) | History exported to one spreadsheet |
| **Strava** | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Recorded workouts read back into the plan |
| **Database** | `DATABASE_URL` | Settings and activities that follow the account between devices |

**One combination to avoid:** Google sign-in without `DATABASE_URL`. A browser
with no stored calendar id will create a calendar, and with nowhere to record
that, a second browser creates a second one. A deployment that signs users in
should have a database. See [_docs/storage.md](_docs/storage.md).

### What Strava does

Once connected, the app reads the last two weeks of recordings **after** the
calendar pull, corrects planned workouts to what was actually done, and adds
anything you did without planning. It is its own OAuth grant, so it works with
or without a Google account.

It reads **once per page load** — the rate limit is 100 reads per fifteen
minutes for the whole app, not per user. "Sync now" in the integrations modal is
the only way to spend another.

### What the database holds

Settings only: your Google and Strava account ids, which calendar your plan
lives in, your preferences, and "My activities". **Events are not in it and will
not be** — Google Calendar stores those. No third-party tokens are stored at
rest.

## Documentation

- **[_docs/](_docs/)** — defined behaviour. Sync order and API budgets, which
  store owns what, onboarding, and the copy rules. Read before changing
  behaviour these cover.
- **[AGENTS.md](AGENTS.md)** — architectural and styling rules. Strict, and
  worth reading first.
- **`_todo/`** — what is proposed but not built. `-MANUAL-*.md` files are
  step-by-step setup for the third-party services; `refactor.md` is the current
  cleanup plan.

## Setup guides

- `_todo/-MANUAL-google-verification.md` — Google Cloud project and OAuth
- `_todo/-MANUAL-strava-setup.md` — registering the app with Strava
- `_todo/-MANUAL-database-setup.md` — Neon and the one migration

## Contributing

Read `AGENTS.md` before making changes — the layering, import and styling rules
are enforced and non-obvious. If you change behaviour that `_docs/` describes,
change the doc and its test in the same commit.
