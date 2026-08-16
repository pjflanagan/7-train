import { NextResponse } from 'next/server';
import { STRAVA_AUTHORIZE_URL, STRAVA_SCOPES } from '@/lib/strava';
import {
  STRAVA_STATE_COOKIE,
  isSecureRequest,
  isStravaConfigured,
  stravaRedirectUri,
} from '@/lib/stravaServer';

/**
 * The way in to Strava's consent screen.
 *
 * A short-lived `state` cookie is minted here and checked on the way back, so a
 * callback the user never started cannot connect an account to their browser.
 */
export async function GET(request: Request) {
  if (!isStravaConfigured) {
    return NextResponse.json({ error: 'Strava is not set up on this server' }, { status: 501 });
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID as string,
    redirect_uri: stravaRedirectUri(request),
    response_type: 'code',
    // Without this, Strava silently reuses an earlier grant and an athlete who
    // has revoked us can never get the screen back.
    approval_prompt: 'auto',
    scope: STRAVA_SCOPES.join(','),
    state,
  });

  const response = NextResponse.redirect(`${STRAVA_AUTHORIZE_URL}?${params}`);
  response.cookies.set(STRAVA_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(request),
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}
