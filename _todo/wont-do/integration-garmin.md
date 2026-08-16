# Garmin

> **Nothing here is built.** This is the plan and the manual setup, written after
> checking what Garmin's API actually offers in August 2026. Read §1 before
> spending any time on §3 — the blocker is not technical.

The original intent, unchanged:

- Load what a user has recorded on Garmin, match by activity type, and replace
  the past day's events with what actually happened.
- Show what Garmin recommends for each day, so it can be dragged into the
  schedule.

The first of those is buildable. **The second is not** — see §2.

---

## 1. Read this first: access is the blocker

Garmin's API is not like Strava's. There is no self-serve key, and the program
is not open to us as written.

From Garmin's own [program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/):

> "After you request the Garmin Connect Developer Program, we will confirm the
> status of your application within two business days."

> The program is **"only for business use."**

> "There are no licensing or maintenance fees" — but "access to some metrics may
> require a license fee payment or minimum device order quantity for commercial
> use."

Three consequences:

1. **Approval is a business review, not a signup.** A human decides, and the
   stated criterion excludes hobby and personal projects. 7 Train is a personal
   workout planner with one user. On the face of it, it does not qualify.
2. **Secondary reporting suggests new sign-ups are currently on hold**, with the
   public access-request form removed and no published re-open date. I could not
   confirm this on Garmin's own pages — the FAQ still describes the application
   flow as if it is live — so treat it as a caution, not a fact.
3. **There is no evaluation tier to build against first.** The sandbox comes
   *after* approval, so unlike Strava there is no way to write and test the
   integration while waiting.

**This makes Garmin a worse fallback than it looks.** Strava's problem is that
reads now cost money — an unwelcome price, but a known one, payable today.
Garmin's problem is that we may simply not be eligible, and cannot find out
without applying and waiting.

I would apply before writing any code, and treat §3 as contingent.

## 2. What the API can and cannot do

I checked this because half the plan above turns out not to be offered.

| Want | API | Verdict |
| --- | --- | --- |
| Read recorded activities | [Activity API](https://developer.garmin.com/gc-developer-program/activity-api/) | **Yes.** Supports "Ping/Pull or Push architecture", plus historical backfill and full `.FIT`/`GPX`/`TCX` files |
| Read Garmin's suggested workouts | — | **No such API.** See below |
| Push *our* plan to the watch | [Training API](https://developer.garmin.com/gc-developer-program/training-api/) | Yes — the opposite direction |

**"Show what Garmin recommends" is not available.** The Training API is
write-only from our side: it "allows you to publish workouts and training plans
to the Garmin Connect calendar". Nothing in the program exposes Garmin's own
daily suggested workout or training readiness as data we can read. That half of
the idea should be dropped, or rethought.

But notice what the Training API *does* offer, because it is arguably better
than what was asked for: **we could publish the week's plan to Garmin Connect**,
so a workout scheduled here appears on the watch and can be started from it.
That is the same trick the Google Calendar integration pulls, on the device the
workout actually happens on. Worth considering as the headline Garmin feature
rather than a consolation prize.

Two more facts that shape the design:

- **OAuth 2.0 with PKCE.** Garmin migrated off OAuth 1.0a; any older tutorial or
  library you find is for the dead flow. The spec is a PDF handed out with
  approval ([public copy](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf)).
- **Pull is supported**, which matters more than it sounds. The push/ping model
  needs a publicly reachable webhook, which a local dev machine has not got.
  Pull fits the way this app already works — once per page load, no server
  running when nobody is looking.

## 3. How we would code it

The good news: the shape already exists. Strava taught us most of this, and the
work is largely generalising rather than inventing.

### 3.1 Do the refactor first

`_todo/refactor.md` §2 is the prerequisite, not a nice-to-have. We currently have
three hand-rolled sync loops, each with its own debounce, ready flag, in-flight
guard and status store. Garmin makes a fourth, and a fourth place to get the
ordering wrong — which has already happened once, silently, in the Strava gate.

Extract `createSyncLoop({ pull, push, dependsOn })` first. Then Garmin supplies
three functions instead of another 250 lines.

### 3.2 Generalise "a recording", not "Strava"

`lib/strava.ts` is already the right shape — `reconcileStrava` is pure, tested,
and only actually needs: a list of recordings with a sport, a start time and a
value; the events on that day; and the activities in play. Rename around a
neutral type:

```ts
interface Recording {
  source: 'strava' | 'garmin';
  sourceId: string;
  sport: string;          // the provider's own vocabulary, not ours
  startLocal: string;
  distanceMeters?: number;
  durationSeconds?: number;
  url?: string;
}
```

Then `reconcileRecordings` replaces `reconcileStrava` and both providers feed it.
The matching rules — event-first, nearest by start time, never touch an event
that already has a recording — carry over unchanged and keep their tests.

### 3.3 Per-provider sport mapping

`Activity.stravaSportTypes` becomes one of two lists, because the vocabularies
differ (`Run` vs `RUNNING`, `WeightTraining` vs `STRENGTH_TRAINING`):

```ts
stravaSportTypes?: string[];
garminActivityTypes?: string[];
```

Both keep the existing `undefined` = never asked / `[]` = answered "nothing"
distinction, and both get icon-based defaults. The activity form grows a Garmin
tab on the same conditional the Strava tab now uses — shown only when Garmin is
connected. That pattern is already in place and needs no new thinking.

A store migration adds the field; seeded activities get Garmin defaults.

### 3.4 Events carry both ids

`ScheduledEvent.garminActivityId` alongside `stravaActivityId`, and the same
"already matched, leave it alone" rule. **The dedupe question is the real design
decision:** someone with both connected would have every workout matched twice,
once per provider, and the second match would overwrite the first.

Given the framing — Garmin *instead of* Strava — the simplest correct answer is
that **the two are mutually exclusive**. Connecting one disconnects the other,
and the integrations modal says so. Supporting both means deciding which source
wins per activity, which is a lot of machinery for a case nobody has asked for.

### 3.5 Server side

Copy `lib/stravaServer.ts` almost verbatim:

- Own OAuth flow, **not** a NextAuth provider — same reasoning as Strava, so a
  Garmin sign-in cannot replace the Google identity everything else keys on.
- Tokens in an `AUTH_SECRET`-encrypted httpOnly cookie. No third-party
  credentials at rest in Postgres, which stays true.
- PKCE adds a `code_verifier` that must survive the round trip: it goes in a
  short-lived cookie next to the existing `state` cookie.
- Routes mirror Strava's: `connect`, `callback`, `status`, `activities`.
- **A `GARMIN_ENABLED` kill switch from day one**, exactly like the one Strava
  just needed. Given how this has gone, assume any integration may need turning
  off in a hurry.

### 3.6 Exact endpoints are deliberately absent

I have not written the activity endpoint URLs, parameter names or the activity
type enum into this doc, because the authoritative list is in the spec PDF that
comes with approval, and the public write-ups disagree with each other. Fill
them in from the real spec rather than from a blog post — Garmin's OAuth 1.0a
era left a lot of confidently wrong material lying around.

## 4. Your manual setup

### Before applying

Decide how to answer "what business is this for", because it is the question the
application turns on and "a personal workout planner" is the answer that gets
declined. If there is a real entity behind 7 Train, apply as it.

### The steps

1. **Request access** at [developer.garmin.com](https://developer.garmin.com/gc-developer-program/)
   — look for the Garmin Connect Developer Program request form. If the form is
   gone, email `connect-support@developer.garmin.com` and ask directly whether
   the program is open.
2. **Wait.** They state two business days to confirm application status, which is
   not the same as two days to approval.
3. **On approval**, you get the Developer Portal, an evaluation environment, the
   OAuth 2.0 PKCE spec and the Activity API spec. Grab all the PDFs — they are
   not public, and §3.6 above is waiting on them.
4. **Create an app** and set the OAuth redirect URI to
   `https://<your-domain>/api/garmin/callback`, plus a `localhost` one for
   development if Garmin allows more than one. Strava does not, which is why
   local development needed its own registered app — check whether Garmin has
   the same restriction, because it changes the setup.
5. **Put the credentials in `.env.local`** and in Netlify:
   ```
   GARMIN_CLIENT_ID=
   GARMIN_CLIENT_SECRET=
   GARMIN_ENABLED=true
   ```
6. **Choose Pull, not Push**, in whatever the portal calls that setting. Push
   needs a public webhook this app has no use for, and pull matches how
   everything else here already works.
7. **Tell me the activity type enum** from the spec, so the sport mapping in
   §3.3 can be filled in with the real values.

### What this will cost

Nothing, unless we ask for metrics behind a license fee. Plain activity data is
not one of those as far as the FAQ describes, but confirm it in the agreement
before building.

## 5. If Garmin says no

Worth deciding in advance, because between Strava's paywall and Garmin's
business-only rule, "no automatic import" is a real possibility.

- **Pay Strava.** The integration is built, tested and working. If the tier is
  affordable, this is by far the cheapest path in engineering time — the code is
  already written and currently switched off.
- **File upload.** Garmin Connect exports `.FIT`/`.TCX`/`.GPX`, and a drop zone
  that parses one and matches it through the same `reconcileRecordings` is a
  contained piece of work with no API, no OAuth and nobody's permission needed.
  Less magic, but it cannot be revoked.
- **Do nothing automatic.** Editing an event to what you actually did takes a few
  seconds, and the planner is already good at that. Worth saying out loud: this
  feature has now cost more than it has returned.

My recommendation, given the evidence: apply to Garmin because it is free to
ask, but do not build against it until approved, and treat file upload as the
fallback that cannot be taken away.

---

**Sources:**
- [Garmin Connect Developer Program — Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/)
- [Garmin Connect Developer Program — Activity API](https://developer.garmin.com/gc-developer-program/activity-api/)
- [Garmin Connect Developer Program — Training API](https://developer.garmin.com/gc-developer-program/training-api/)
- [Garmin Connect Developer Program — Overview](https://developer.garmin.com/gc-developer-program/)
- [OAuth 2.0 PKCE specification (PDF)](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf)
