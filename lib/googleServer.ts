import { getToken } from 'next-auth/jwt';
import {
  GoogleRefreshError,
  GoogleTokens,
  hasScopes,
  isAccessTokenExpired,
  refreshGoogleTokens,
} from '@/lib/google';

/**
 * Server-only access to the caller's Google tokens. Never import this from a
 * client component: the access token deliberately stays out of the session
 * payload the browser receives, and this is how a route handler gets at it.
 *
 * Usage from a route handler:
 *
 * ```ts
 * const token = await getGoogleAccessToken(request, GOOGLE_INTEGRATIONS.calendar.scopes);
 * if (!token) return new Response('Not connected', { status: 403 });
 * ```
 */
export async function getGoogleAccessToken(
  request: Request,
  requiredScopes: string[] = []
): Promise<string | null> {
  const tokens = await readGoogleTokens(request);
  if (!tokens || !hasScopes(tokens.scopes, requiredScopes)) return null;

  if (!isAccessTokenExpired(tokens)) return tokens.accessToken ?? null;

  // The JWT cookie holds whatever the last session read wrote, which may have
  // gone stale since. Refreshing here does not rewrite the cookie — the next
  // session read does that — so this is a per-request refresh.
  try {
    const refreshed = await refreshGoogleTokens(tokens);
    return refreshed.accessToken ?? null;
  } catch (error) {
    if (error instanceof GoogleRefreshError) return null;
    throw error;
  }
}

async function readGoogleTokens(request: Request): Promise<GoogleTokens | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  // The cookie is `__Secure-` prefixed over https and bare over http, and we
  // cannot tell which from inside a proxied request, so try both names.
  for (const secureCookie of [true, false]) {
    const token = await getToken({ req: request, secret, secureCookie });
    if (token?.google) return token.google;
  }
  return null;
}
