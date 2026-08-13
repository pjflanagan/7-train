# Google sign in — what you have to do by hand

Everything in the app is wired up. What is left is the part that lives in the
Google Cloud console and in your environment variables, which nobody can do for
you. Until those exist the app behaves exactly as it did before: the header
avatar opens a dropdown with **Settings** only, and no sign in is offered.

---

## 1. Create the Google Cloud project

1. Go to <https://console.cloud.google.com/> and create a project (e.g. `7-train`).
2. Under **APIs & services → Library**, enable:
   - **Google Calendar API** — for calendar sync.
   - **Google Sheets API** — for the spreadsheet export.
   - **Google Drive API** — the Sheets export creates the file through Drive's
     per-file scope.

   Sign in works without any of these enabled. Enable them before building the
   integrations, not before your first sign in.

## 2. Configure the OAuth consent screen

**APIs & services → OAuth consent screen**

- **User type**: External (unless you have a Workspace org and only ever want to
  sign in with that org's accounts).
- App name, support email, developer contact — required.
- **Authorized domains**: your production domain (e.g. `7-train.vercel.app`).
- **Scopes**: add the three below. You can add them later, but the consent
  screen has to list a scope before Google will grant it.

| Scope                           | Why                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `openid`, `email`, `profile`    | Identity. Requested at sign in.                                                                                        |
| `.../auth/calendar.app.created` | Create a Workouts calendar and manage **only** calendars this app created. Deliberately not the full `calendar` scope. |
| `.../auth/drive.file`           | Create and keep editing the export spreadsheet, and nothing else in Drive.                                             |

- **Test users**: while the app is in _Testing_, only accounts you list here can
  sign in, up to 100. Add your own Google account. This is enough for personal
  use — you never have to publish.
- **Publishing / verification**: only needed if other people will sign in.
  `calendar.app.created` counts as a sensitive scope, so publishing means going
  through Google's verification review (app homepage, privacy policy, a demo
  video). Staying in Testing avoids all of it.

## 3. Create the OAuth client

**APIs & services → Credentials → Create credentials → OAuth client ID**

- **Application type**: Web application.
- **Authorized JavaScript origins**:
  - `http://localhost:3000`
  - `https://your-production-domain`
- **Authorized redirect URIs** — these must match exactly:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://your-production-domain/api/auth/callback/google`

Copy the client ID and client secret.

> **Vercel preview deployments**: every preview gets its own random hostname,
> and Google will not accept wildcards. Sign in only works on localhost and on
> the domains you registered. If you need it on previews, register one stable
> preview domain and set `AUTH_URL` to it for the Preview environment.

## 4. Set the environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
openssl rand -base64 32   # paste into AUTH_SECRET
```

| Variable             | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| `AUTH_SECRET`        | Random 32 bytes. Encrypts the session cookie.             |
| `AUTH_GOOGLE_ID`     | Client ID from step 3.                                    |
| `AUTH_GOOGLE_SECRET` | Client secret from step 3.                                |
| `AUTH_URL`           | Optional. Only if the app cannot work out its own origin. |

`.env.local` is gitignored. `.env.example` is committed and holds no values.

## 5. Add the same variables on Vercel

**Project → Settings → Environment Variables**, for Production (and Preview if
you registered a preview domain). Redeploy — environment variables are read at
build and run time, and an existing deployment will not pick them up.

Vercel's Google integration is not used here; NextAuth talks to Google directly,
so these three variables are all the platform needs.

## 6. Check it works

1. `npm run dev`, open the app, click the avatar in the header.
2. The dropdown should now show **Sign in with Google** above **Settings**.
3. Sign in. The avatar becomes your Google profile picture.
4. Reopen the dropdown → **Account**. Connect **Google Calendar** and
   **Google Sheets**; each sends you back through Google's consent screen for
   that one integration, and the row flips to **Connected**.

If sign in returns `redirect_uri_mismatch`, the redirect URI in step 3 does not
match the origin you are browsing — down to the port and the `https`.

---

## What is already built

- Google sign in via NextAuth v5 (`next-auth@beta`), JWT sessions, no database.
- The header settings button is now a profile picture. Its dropdown has two
  items: account (sign in, or manage the signed-in account) and settings.
- Incremental consent: signing in asks only for identity. Calendar and Sheets
  scopes are requested individually, from the account modal, when you connect
  that integration.
- Refresh tokens are stored on the session and swapped for fresh access tokens
  automatically. If Google rejects the refresh token the session survives, the
  avatar grows a warning dot, and the account modal offers to reconnect.
- The access token is deliberately **not** in the session the browser receives.
  Server code reads it with `getGoogleAccessToken(request, scopes)` from
  `lib/googleServer.ts`.

## What is not built yet

Connecting an integration grants access. Nothing reads or writes your Google
account yet. The pieces below are still open, and the plans in
`_todo/future/integration-google.md` are the source for them:

- **Calendar sync** — create a `Workouts` calendar, mirror every change into it,
  and replace local state with the calendar's contents on load. Needs a
  time-of-day on each workout, which the planner does not model yet (items only
  have a day). Reading the calendar back also covers the case of dragging a long
  run from Sunday to Saturday inside Google Calendar and having the app follow.
- **Sheets export** — write past workouts to a spreadsheet, the hosted version of
  today's CSV export in `lib/csv.ts`.
- **Goals in a database** — goals live in `localStorage` today. A signed-in user
  should get them server side, keyed by their Google account ID
  (`token.sub`). Vercel Postgres or Neon both fit; that choice is still open, and
  it is the one piece here that needs infrastructure beyond a Google project.

Each of those is a route handler under `app/api/`, calling
`getGoogleAccessToken` for the token and `GOOGLE_INTEGRATIONS` in `lib/google.ts`
for the scopes it requires.
