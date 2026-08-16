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

/**
 * The shape of the thing that went wrong: a v4 UUID.
 *
 * Google's `sub` is a short numeric string. Auth.js's per-sign-in `token.sub`
 * is a UUID. Rather than assert what Google's ids look like — that is their
 * format to change, not ours to police — this refuses the one shape we know is
 * not an identity, so the same mistake cannot come back quietly through a
 * different route.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUsableGoogleSub(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !UUID.test(value);
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
    // Deliberately `googleSub` and never `token.sub`. See the note on the JWT
    // declaration in `lib/auth.ts`: `token.sub` is a per-sign-in UUID, and
    // keying the database on it gave one person a new account every login.
    //
    // A session minted before `googleSub` existed has none, and is treated as
    // not signed in *for settings purposes only* — the route answers 401, the
    // client quietly falls back to local storage, and the next sign in issues a
    // token that works. Guessing an identity is the one thing not to do here.
    if (isUsableGoogleSub(token?.googleSub)) {
      return {
        googleSub: token.googleSub,
        email: typeof token.email === 'string' ? token.email : null,
        name: typeof token.name === 'string' ? token.name : null,
      };
    }
  }
  return null;
}
