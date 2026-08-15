import { NextResponse } from 'next/server';
import { STRAVA_SCOPES } from '@/lib/strava';
import {
  STRAVA_STATE_COOKIE,
  exchangeStravaCode,
  readCookie,
  requestOrigin,
  stravaCookieHeader,
} from '@/lib/stravaServer';

/**
 * Where Strava sends the athlete back to.
 *
 * Everything ends at the planner rather than at a JSON body, with the outcome
 * in the query string — this is a page the user is looking at, not an API call.
 */
export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const { searchParams } = new URL(request.url);

  const back = (outcome: string) =>
    NextResponse.redirect(`${origin}/?strava=${outcome}`);

  // The athlete pressed cancel, or Strava is unhappy. Either way, nothing to do.
  if (searchParams.get('error')) return back('denied');

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const expected = readCookie(request, STRAVA_STATE_COOKIE);
  if (!code || !state || !expected || state !== expected) return back('failed');

  // Strava lets the athlete untick permissions on the consent screen. Without
  // `activity:read` there is nothing to read, so that is a denial too.
  const granted = (searchParams.get('scope') ?? '').split(',');
  if (!STRAVA_SCOPES.every((scope) => granted.includes(scope))) return back('scope');

  try {
    const tokens = await exchangeStravaCode(code);
    const response = back('connected');
    response.headers.append('Set-Cookie', await stravaCookieHeader(request, tokens));
    // The round trip is over, so the guard goes with it.
    response.cookies.delete(STRAVA_STATE_COOKIE);
    return response;
  } catch (error) {
    console.error('Strava connect failed', error);
    return back('failed');
  }
}
