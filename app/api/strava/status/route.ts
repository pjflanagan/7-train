import { NextResponse } from 'next/server';
import {
  isStravaConfigured,
  readStravaTokens,
  stravaCookieHeader,
} from '@/lib/stravaServer';

/** Whether this browser has Strava connected, and to whom. */
export async function GET(request: Request) {
  const tokens = isStravaConfigured ? await readStravaTokens(request) : null;

  return NextResponse.json({
    isConfigured: isStravaConfigured,
    isConnected: Boolean(tokens),
    athleteName: tokens?.athleteName ?? null,
  });
}

/**
 * Disconnect. The cookie is dropped, which is the whole of the connection on
 * our side; the grant itself is the athlete's to revoke at strava.com.
 */
export async function DELETE(request: Request) {
  const response = NextResponse.json({ isConnected: false });
  response.headers.append('Set-Cookie', await stravaCookieHeader(request, null));
  return response;
}
