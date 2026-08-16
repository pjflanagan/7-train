/**
 * Who is calling. Server only.
 *
 * `lib/googleServer.ts` answers "what may this request do at Google"; this
 * answers the plainer question of who the request belongs to, which is all the
 * settings routes need. They are separate because a user with no Google API
 * scopes at all still has settings.
 */

import { getToken } from 'next-auth/jwt';

export interface SessionIdentity {
  /** Google's subject claim — stable across email changes, so it is the key. */
  googleSub: string;
  email: string | null;
  name: string | null;
}

export async function readSessionIdentity(
  request: Request
): Promise<SessionIdentity | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  // The cookie is `__Secure-` prefixed over https and bare over http, and a
  // proxied request cannot tell us which, so both names are tried — same dance
  // as `readGoogleTokens`.
  for (const secureCookie of [true, false]) {
    const token = await getToken({ req: request, secret, secureCookie });
    if (token?.sub) {
      return {
        googleSub: token.sub,
        email: typeof token.email === 'string' ? token.email : null,
        name: typeof token.name === 'string' ? token.name : null,
      };
    }
  }
  return null;
}
