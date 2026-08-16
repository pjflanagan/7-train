import { NextResponse } from 'next/server';
import { getGoogleAccessToken } from '@/lib/googleServer';
import { GOOGLE_INTEGRATIONS } from '@/lib/google';
import {
  ensureWorkoutsCalendar,
  GoogleApiError,
  WORKOUTS_CALENDAR_SUMMARY,
} from '@/lib/googleCalendar';

/**
 * Makes the `Workouts` calendar, once.
 *
 * The only place a calendar is ever created, and still deliberately not
 * something syncing can do by itself: this is called by `useEnsureCalendar`,
 * which first waits to be told whether the account already has one. Letting a
 * sync create a calendar whenever it noticed an id missing is what once made
 * three of them.
 */
export async function POST(request: Request) {
  const accessToken = await getGoogleAccessToken(request, GOOGLE_INTEGRATIONS.calendar.scopes);
  if (!accessToken) {
    return NextResponse.json({ error: 'Calendar is not connected' }, { status: 403 });
  }

  try {
    const calendarId = await ensureWorkoutsCalendar(accessToken, null);
    return NextResponse.json({ calendarId, calendarName: WORKOUTS_CALENDAR_SUMMARY });
  } catch (error) {
    if (error instanceof GoogleApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Calendar creation failed', error);
    return NextResponse.json({ error: 'Could not create a calendar' }, { status: 500 });
  }
}
