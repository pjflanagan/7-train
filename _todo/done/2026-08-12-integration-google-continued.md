# Prompt

I want users to be able to use this locally. But if they choose to sign in with Google then we will sync with a calendar.

First, in the dropdown instead of Account make it say
- Integrations
- Settings
- Logout

## Google Calendar

- Google Calendar is our new DB (for events), user signs in with Google
- We make a new calendar called Workouts
- Everything we change in the app gets updated in the Google calendar
- On page load we replace our local with whatever Google calendar has
- Our local now needs to be able to set when each event is happening during the day, by dragging it up and down through the day in 15 minute increments

## Google Sheets

- Past events get recorded to a spreadsheet in Google Sheets as well
- If a user sets it up

# Post Build

## What is built

- **Profile menu** — integrations, settings, logout.
- **Time of day** — `CalendarItem` carries `startMinutes`, minutes from local
  midnight snapped to 15. The chip on each card drags up and down to move the
  workout through the day; arrow keys do the same, shift for an hour. A day
  renders in time order, and reordering by drag swaps which workout sits in
  which of that day's existing slots.
- **Durations** — a `duration` goal's value _is_ the event length, so the
  calendar reflects it exactly. Distance goals are estimated from a per-mile
  pace picked by the goal's icon (km converted first), count goals get a flat
  45 minutes. Estimates are shown with a `~`. See `lib/schedule.ts`.
- **Calendar sync** (`hooks/useCalendarSync.ts`, `app/api/calendar/route.ts`) —
  creates and reuses a `Workouts` calendar, pulls a window of weeks on load and
  lets Google win, then mirrors every local change back on a debounce. Each
  event carries the item id, goal id, sub-type and value in its private
  extended properties, which is how a workout dragged to another day inside
  Google Calendar comes back to the right place here.
- **Sheets export** (`hooks/useSheetsExport.ts`, `app/api/sheets/route.ts`) —
  the same rows as the CSV export, written into one spreadsheet that later
  exports overwrite. Triggered from the integrations modal.

## Decisions

- **Goals stay local.** No database. An event names the goal it belongs to and
  nothing else, so the calendar is independent of the goal list — an event for
  a goal this device does not have is left in Google, untouched, rather than
  drawn.
- **Only the pulled window is replaced.** Weeks outside it were never sent to
  Google, so an empty response there means "not asked", not "empty".
- **Local-only items survive a pull** and are pushed up straight after, so a
  plan made offline is not lost.
