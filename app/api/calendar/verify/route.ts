import { NextResponse } from 'next/server';
import { getGoogleAccessToken } from '@/lib/googleServer';
import { GOOGLE_INTEGRATIONS } from '@/lib/google';
import { getCalendar, GoogleApiError } from '@/lib/googleCalendar';

/**
 * Checks that a calendar id names a calendar we can actually use, before the
 * app commits to it.
 *
 * This exists so that pointing the app at an existing calendar cannot go wrong
 * quietly: `ensureWorkoutsCalendar` treats an unreachable id as "make a new
 * one", which for a mistyped id would mean yet another `Workouts` calendar.
 */
export async function GET(request: Request) {
  const accessToken = await getGoogleAccessToken(request, GOOGLE_INTEGRATIONS.calendar.scopes);
  if (!accessToken) {
    return NextResponse.json({ error: 'Calendar is not connected' }, { status: 403 });
  }

  const calendarId = new URL(request.url).searchParams.get('calendarId')?.trim();
  if (!calendarId) {
    return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
  }

  try {
    const calendar = await getCalendar(accessToken, calendarId);
    if (!calendar) {
      return NextResponse.json({ found: false });
    }
    return NextResponse.json({ found: true, calendarId: calendar.id, summary: calendar.summary });
  } catch (error) {
    if (error instanceof GoogleApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Calendar lookup failed', error);
    return NextResponse.json({ error: 'Calendar lookup failed' }, { status: 500 });
  }
}
