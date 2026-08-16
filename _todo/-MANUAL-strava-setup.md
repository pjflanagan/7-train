# Manual: connecting Strava

Everything in the app is built. What is left is the part only you can do —
registering the app with Strava and putting two secrets in the environment.
Until `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are set, the Strava section
of the integrations modal does not render at all, so nothing looks broken while
you get to this.

Budget about ten minutes.

---

## 1. Create the Strava API application

Go to **https://www.strava.com/settings/api** (Settings → My API Application).
You need a normal Strava account; there is no separate developer signup, no
review, and no cost.

Fill in:

| Field                      | What to put                                                                 |
| -------------------------- | --------------------------------------------------------------------------- |
| **Application Name**       | `7 Train` (this is what the athlete sees on the consent screen)              |
| **Category**               | Training                                                                     |
| **Club**                   | leave blank                                                                  |
| **Website**                | your deployed URL, e.g. `https://sevent.rain.example`                        |
| **Application Description**| "Plans workouts and matches them against what you actually did."             |
| **Authorization Callback Domain** | **the bare domain only** — see the warning below                      |

### The callback domain is the part people get wrong

Strava asks for a **domain**, not a URL. No scheme, no path, no port:

- ✅ `sevent.rain.example`
- ❌ `https://sevent.rain.example`
- ❌ `sevent.rain.example/api/strava/callback`

Strava then accepts any callback under that domain, which is why the app can
send it `/api/strava/callback` without registering the path.

**One domain per application.** There is no list. So for local development you
need a second Strava application with the callback domain set to `localhost` —
make that one first, since it is the one you will use while testing.

Finally, upload an icon. Strava requires one before it will show the consent
screen properly, and the field is easy to skip past.

## 2. Copy the credentials

The page now shows **Client ID** and **Client Secret** (click "Show"). Put both
in your environment:

```bash
# .env.local — never commit this
STRAVA_CLIENT_ID=123456
STRAVA_CLIENT_SECRET=0000000000000000000000000000000000000000
```

There is no third variable. The callback URL is derived from the request the
browser actually made, so the same code works on localhost and in production
without being told where it lives.

`AUTH_SECRET` must also be set — it already is, for Google sign in, and Strava
reuses it to encrypt its own token cookie. If you ever rotate it, everyone's
Strava connection drops and has to be reconnected; nothing else breaks.

For the deployed app, set the same two variables wherever you set the Google
ones (Netlify: **Site configuration → Environment variables**), then redeploy —
these are read at request time on the server, but the build needs to happen
after they exist for the section to appear.

## 3. Connect, and check it worked

1. Restart `next dev` so the new environment is picked up.
2. Open the app → profile menu → **Integrations**. A **Strava** section is now
   below the Google one. You do not have to be signed in with Google for it to
   work — Strava is its own grant.
3. Press **Connect**. Strava's consent screen asks for "View data about your
   activities". Both boxes must stay ticked; unticking the activity one comes
   back as "Strava needs permission to read your activities" and connects
   nothing.
4. You land back on the planner with a "Strava connected" toast, and the row now
   shows your name.

Within a few seconds — after the Google Calendar pull finishes, which the Strava
read deliberately waits for — this week's and last week's recordings appear:
planned workouts get their real distances and a small orange Strava mark in the
card's top bar, and anything you did without planning shows up as a new event on
the day it happened. The mark links out to the recording on strava.com.

## 4. Things worth knowing before you rely on it

**The window is two weeks.** This week and last week, nothing more. Strava
allows 100 reads per fifteen minutes and 1,000 a day across the whole app, so
the read happens once per page load rather than continuously. **Sync now** in
the integrations modal forces another one.

**A workout is only corrected once.** Once an event carries a Strava id, sync
never touches it again — so if you fix a distance by hand afterwards, it stays
fixed, and moving the workout to another day does not make Strava re-add it on
the old one.

**Each activity says which Strava sports it is.** Open an activity in "My
activities" and there is a **Strava** tab listing every sport Strava records;
tick the ones this activity answers to. Your existing activities were filled in
for you from the icon they already used, so there is nothing to do unless you
want to be more specific.

Two activities can claim the same sport — "Long run" and "Easy run" are both
`Run` — because a recording is matched against **what you planned that day**,
not against the activity list. It lands on the nearest planned workout in time
whose activity accepts the sport. Only when nothing was planned does it fall
back to the first activity accepting that sport, and add a new event.

A sport no activity claims is skipped and named in a toast, so you know to go
tick it somewhere rather than wondering where your ride went. One deliberate
change from the first version: the rowing default no longer swallows `Kayaking`,
`Canoeing` and `StandUpPaddling` — tick them on an activity if you want them.

**Rate limits are per application, not per user.** If you ever share this with
more than a handful of people, the 15-minute limit is the first thing that will
bite, and the fix is a server-side cache rather than more requests.

## Things you might want later

Nothing below is built, and none of it is needed to use the integration.

- **Webhooks.** Strava can push an event the moment a workout is uploaded,
  instead of the app pulling. It needs a public HTTPS endpoint that answers
  Strava's verification challenge, and somewhere to store the subscription — so
  it wants the database in `_todo/database.md` first.
- **Backfilling history.** Strava will happily return years of activities, but
  it would have to be a deliberate one-off import with its own progress UI, not
  something the load-time sync does.
- **Splits, heart rate, elevation.** All in the payload, none of it stored. The
  event links out to Strava for anything past distance and time.
- **An npm client.** `strava-v3`, `strava` and `strava-api-client` all exist and
  none is worth the dependency: we call two endpoints, and the best-typed of
  them ships a `SportType` union that is already behind the API — no racquet
  sports, no Pilates, no HIIT. `lib/stravaSports.ts` is where our own list
  lives, and where to add a sport when Strava adds one.
- **Uploading planned workouts to Strava.** Deliberately not done: Strava is a
  record of the past, and the plan already lives in Google Calendar.
- **Rich detail on the card.** The link is a small orange mark in the header. If
  the actual pace should show on the card next to the planned distance, the data
  is there to compute it.
