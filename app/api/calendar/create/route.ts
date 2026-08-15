import { NextResponse } from 'next/server';
import { getGoogleAccessToken } from '@/lib/googleServer';
import { GOOGLE_INTEGRATIONS } from '@/lib/google';
import { ensureWorkoutsCalendar, GoogleApiError } from '@/lib/googleCalendar';

/**
 * Makes the `Workouts` calendar, once, because the user asked for it.
 *
 * The only place a calendar is ever created. Syncing deliberately cannot do it:
 * a calendar is a thing the user ends up owning and looking at, so it comes
 * from a decision rather than from a background request finding an id missing.
 */
export async function POST(request: Request) {
  const accessToken = await getGoogleAccessToken(request, GOOGLE_INTEGRATIONS.calendar.scopes);
  if (!accessToken) {
    return NextResponse.json({ error: 'Calendar is not connected' }, { status: 403 });
  }

  try {
    const calendarId = await ensureWorkoutsCalendar(accessToken, null);
    return NextResponse.json({ calendarId });
  } catch (error) {
    if (error instanceof GoogleApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Calendar creation failed', error);
    return NextResponse.json({ error: 'Could not create a calendar' }, { status: 500 });
  }
}
