import { NextResponse } from 'next/server';
import { apiError, notConnected } from '@/lib/apiError';
import { getGoogleAccessToken } from '@/lib/googleServer';
import { GOOGLE_INTEGRATIONS } from '@/lib/google';
import { isDatabaseConfigured } from '@/lib/db/client';
import { getOrCreateUser, readCalendarId, writeCalendarId } from '@/lib/db/users';
import { readSessionIdentity } from '@/lib/sessionServer';
import { ensureWorkoutsCalendar } from '@/lib/googleCalendar';

/**
 * Makes the `Workouts` calendar, once.
 *
 * The only place a calendar is ever created, and still deliberately not
 * something syncing can do by itself: this is called by `useEnsureCalendar`,
 * which first waits to be told whether the account already has one. Letting a
 * sync create a calendar whenever it noticed an id missing is what once made
 * three of them.
 *
 * That wait is no longer the only thing standing between a user and a second
 * calendar. It cannot be: it is a check one browser makes about its own
 * `localStorage`, and the failures that produce duplicates are the ones where
 * the browser is wrong about that — a settings pull that failed, two tabs
 * opened together, a render that got ahead of the pull. So the row is asked
 * here too, where the answer is shared by every browser and every tab, and a
 * user who already has a calendar is handed it back rather than given another.
 *
 * A POST is therefore "make sure this account has a calendar", not "make a
 * calendar", and calling it twice is not a way to end up with two.
 */
export async function POST(request: Request) {
  const accessToken = await getGoogleAccessToken(request, GOOGLE_INTEGRATIONS.calendar.scopes);
  if (!accessToken) {
    return notConnected('Calendar');
  }

  // No database is a supported deployment, and there the browser's own guard is
  // all there is — the same as before any of this existed.
  const identity = isDatabaseConfigured ? await readSessionIdentity(request) : null;

  try {
    let userId: string | null = null;
    let knownCalendarId: string | null = null;

    if (identity) {
      userId = (await getOrCreateUser(identity)).id;
      knownCalendarId = await readCalendarId(userId);
    }

    const ensured = await ensureWorkoutsCalendar(accessToken, knownCalendarId);
    let calendarId = ensured.calendarId;

    // Written down before answering rather than left to the browser's debounced
    // settings push, so the tab that asks a second later is told about this one.
    if (userId && ensured.created) {
      calendarId = await writeCalendarId(userId, calendarId);
    }

    return NextResponse.json({
      calendarId,
      calendarName: ensured.calendarName,
      // The caller adopts an existing calendar instead of filling it: it
      // already holds the plan, and pushing a local copy over the top is how
      // one calendar ends up with everything twice.
      created: ensured.created && calendarId === ensured.calendarId,
    });
  } catch (error) {
    return apiError(error, 'Calendar creation failed', 'Could not create a calendar');
  }
}
