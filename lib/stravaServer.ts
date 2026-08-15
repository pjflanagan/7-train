/**
 * Strava tokens, and the calls made with them. Server only.
 *
 * Strava is not a NextAuth provider here, and deliberately so: signing in is
 * Google's job, and adding a second provider would mean a Strava sign in could
 * replace the identity the rest of the app is built on. So this is its own
 * small OAuth flow, and the tokens live in their own encrypted cookie —
 * connecting Strava neither requires a Google account nor disturbs one.
 *
 * The cookie is written with the same JWE machinery NextAuth uses for its
 * session, keyed off `AUTH_SECRET`, so the browser is handed an opaque string
 * and the access token never leaves the server.
 */

import { encode, decode } from 'next-auth/jwt';
import { STRAVA_API, STRAVA_TOKEN_URL, StravaActivity } from './strava';

/** Bare over http and `__Secure-` prefixed over https, as NextAuth's own are. */
const COOKIE_BASE = 'strava.tokens';

/** Refresh tokens do not expire, so the connection is meant to outlive a month. */
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Refresh a little early so a token cannot expire mid-request. */
const EXPIRY_SKEW_SECONDS = 60;

/** The `state` cookie guarding the round trip through Strava's consent screen. */
export const STRAVA_STATE_COOKIE = 'strava.state';

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds, as Strava reports it. */
  expiresAt: number;
  /** What the athlete actually consented to, so we can tell a partial grant. */
  scopes: string[];
  athleteId?: number;
  athleteName?: string;
}

export function stravaCookieName(isSecure: boolean): string {
  return isSecure ? `__Secure-${COOKIE_BASE}` : COOKIE_BASE;
}

/** True when the request reached us over https, proxies included. */
export function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim() === 'https';
  return new URL(request.url).protocol === 'https:';
}

/**
 * Where this app is reachable, as the browser reached it. Strava wants an
 * absolute `redirect_uri`, and behind a proxy the request's own URL is the
 * internal one, so the forwarded headers win where they are set.
 */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? url.host;
  const protocol = isSecureRequest(request) ? 'https' : url.protocol.replace(':', '');
  return `${protocol}://${host}`;
}

/** The callback Strava sends the athlete back to, and the one to register. */
export function stravaRedirectUri(request: Request): string {
  return `${requestOrigin(request)}/api/strava/callback`;
}

/**
 * True once the deployment has Strava credentials. Like the Google equivalent,
 * this is read server side and handed down, so a deployment without them hides
 * the integration rather than offering a button that can only fail.
 */
export const isStravaConfigured = Boolean(
  process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET && process.env.AUTH_SECRET
);

function requireSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return secret;
}

export async function encodeStravaTokens(tokens: StravaTokens): Promise<string> {
  return encode({
    token: tokens as unknown as Record<string, unknown>,
    secret: requireSecret(),
    salt: COOKIE_BASE,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** The tokens on a request, or null when Strava is not connected in this browser. */
export async function readStravaTokens(request: Request): Promise<StravaTokens | null> {
  if (!process.env.AUTH_SECRET) return null;

  // Which name the cookie has depends on the scheme, which a proxied request
  // cannot always tell us, so both are tried.
  for (const isSecure of [true, false]) {
    const raw = readCookie(request, stravaCookieName(isSecure));
    if (!raw) continue;
    try {
      const decoded = await decode<Record<string, unknown>>({
        token: raw,
        secret: requireSecret(),
        salt: COOKIE_BASE,
      });
      if (decoded?.refreshToken) return decoded as unknown as StravaTokens;
    } catch {
      // A cookie we cannot read is a cookie from another secret. Treat it as
      // not connected; the next connect overwrites it.
    }
  }
  return null;
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return undefined;
}

export function isStravaTokenExpired(tokens: StravaTokens, now = Date.now()): boolean {
  return now >= (tokens.expiresAt - EXPIRY_SKEW_SECONDS) * 1000;
}

/** Thrown when Strava will not take the stored refresh token any more. */
export class StravaAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StravaAuthError';
  }
}

export class StravaApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'StravaApiError';
  }
}

interface StravaTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  scope?: string;
  athlete?: { id?: number; firstname?: string; lastname?: string };
  message?: string;
}

async function postToken(body: Record<string, string>): Promise<StravaTokenResponse> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new StravaAuthError('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET are not set');
  }

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...body,
    }),
  });

  const payload = (await response.json().catch(() => null)) as StravaTokenResponse | null;
  if (!response.ok || !payload?.access_token || !payload.refresh_token) {
    throw new StravaAuthError(
      `Strava refused the token request: ${payload?.message ?? response.status}`
    );
  }
  return payload;
}

function tokensFrom(payload: StravaTokenResponse, previous?: StravaTokens): StravaTokens {
  const athlete = payload.athlete;
  const name = athlete
    ? [athlete.firstname, athlete.lastname].filter(Boolean).join(' ')
    : undefined;

  return {
    accessToken: payload.access_token as string,
    refreshToken: payload.refresh_token as string,
    expiresAt: payload.expires_at ?? Math.floor(Date.now() / 1000) + 6 * 60 * 60,
    // Only the first exchange names the scopes; a refresh echoes nothing, so
    // what the athlete consented to is carried forward.
    scopes: payload.scope ? payload.scope.split(',') : previous?.scopes ?? [],
    athleteId: athlete?.id ?? previous?.athleteId,
    athleteName: name || previous?.athleteName,
  };
}

/** Trades the one-time code from the consent screen for a lasting connection. */
export async function exchangeStravaCode(code: string): Promise<StravaTokens> {
  return tokensFrom(await postToken({ code, grant_type: 'authorization_code' }));
}

export async function refreshStravaTokens(tokens: StravaTokens): Promise<StravaTokens> {
  const payload = await postToken({
    refresh_token: tokens.refreshToken,
    grant_type: 'refresh_token',
  });
  return tokensFrom(payload, tokens);
}

/**
 * Usable tokens for this request, refreshing when they have aged out.
 *
 * A refresh mints a new refresh token, so the caller is handed back whatever it
 * should write to the cookie — `changed` says whether it has to.
 */
export async function getStravaTokens(
  request: Request
): Promise<{ tokens: StravaTokens; changed: boolean } | null> {
  const stored = await readStravaTokens(request);
  if (!stored) return null;
  if (!isStravaTokenExpired(stored)) return { tokens: stored, changed: false };
  return { tokens: await refreshStravaTokens(stored), changed: true };
}

/**
 * The athlete's own recordings between two instants, newest first.
 *
 * `per_page` is capped rather than paged through: Strava's read limit is 100
 * calls per fifteen minutes, and the window this app asks for is two weeks — a
 * fortnight that overflows 200 recordings is not a fortnight of workouts.
 */
export async function listStravaActivities(
  accessToken: string,
  after: Date,
  before: Date
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    after: String(Math.floor(after.getTime() / 1000)),
    before: String(Math.floor(before.getTime() / 1000)),
    per_page: '200',
  });

  const response = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new StravaApiError(
      body?.message ?? `Strava returned ${response.status}`,
      response.status
    );
  }

  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as StravaActivity[]) : [];
}

/** The `Set-Cookie` that stores a connection, or clears one when tokens are null. */
export async function stravaCookieHeader(
  request: Request,
  tokens: StravaTokens | null
): Promise<string> {
  const isSecure = isSecureRequest(request);
  const name = stravaCookieName(isSecure);
  const attributes = [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    isSecure ? 'Secure' : '',
  ].filter(Boolean);

  if (!tokens) {
    return [`${name}=`, ...attributes, 'Max-Age=0'].join('; ');
  }

  const value = await encodeStravaTokens(tokens);
  return [`${name}=${value}`, ...attributes, `Max-Age=${COOKIE_MAX_AGE_SECONDS}`].join('; ');
}
