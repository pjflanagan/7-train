import { NextResponse } from 'next/server';
import { apiError, badRequest, notConnected } from '@/lib/apiError';
import {
  StravaAuthError,
  getStravaTokens,
  listStravaActivities,
  stravaCookieHeader,
} from '@/lib/stravaServer';

/**
 * What the athlete actually did, between two instants.
 *
 * The window is the caller's to choose and deliberately small — see
 * `STRAVA_WEEKS_BACK`. Strava allows 100 reads per fifteen minutes across the
 * whole app, so this is one call per sync and never a page-through.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) {
    return badRequest('from and to are required');
  }

  const after = new Date(from);
  const before = new Date(to);
  if (Number.isNaN(after.getTime()) || Number.isNaN(before.getTime())) {
    return badRequest('from and to must be dates');
  }

  let session;
  try {
    session = await getStravaTokens(request);
  } catch (error) {
    // The refresh token stopped working — revoked at strava.com, most likely.
    // Clear the cookie so the app offers a fresh connect rather than retrying.
    console.error('Strava refresh failed', error);
    const response = NextResponse.json(
      { error: 'Strava needs connecting again', code: 'reconnect' },
      { status: 401 }
    );
    response.headers.append('Set-Cookie', await stravaCookieHeader(request, null));
    return response;
  }

  if (!session) {
    return notConnected('Strava');
  }

  try {
    const activities = await listStravaActivities(session.tokens.accessToken, after, before);
    const response = NextResponse.json({ activities });
    // A refresh mints a new refresh token, so the cookie has to keep up or the
    // next sync would present one Strava has already rotated away.
    if (session.changed) {
      response.headers.append('Set-Cookie', await stravaCookieHeader(request, session.tokens));
    }
    return response;
  } catch (error) {
    // `StravaAuthError` carries no status of its own — it means the grant is
    // gone, which is a 401 whatever else went wrong.
    if (error instanceof StravaAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return apiError(error, 'Strava read failed', 'Could not read Strava');
  }
}
