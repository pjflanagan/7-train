/**
 * Google OAuth scopes and token plumbing. Shared by the NextAuth config and by
 * any route handler that needs to call a Google API on the user's behalf.
 */

/** The Google endpoint that trades a refresh token for a fresh access token. */
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Signing in asks for identity only. The API scopes below are granted later,
 * one integration at a time, so a user who just wants a profile picture never
 * sees a consent screen asking for their calendar.
 */
export const GOOGLE_BASE_SCOPES = ['openid', 'email', 'profile'];

export type GoogleIntegrationId = 'calendar' | 'sheets';

export interface GoogleIntegration {
  id: GoogleIntegrationId;
  label: string;
  /** Sentence-case blurb shown next to the connect button. */
  description: string;
  /** Everything the integration needs on top of the base scopes. */
  scopes: string[];
}

export const GOOGLE_INTEGRATIONS: Record<GoogleIntegrationId, GoogleIntegration> = {
  calendar: {
    id: 'calendar',
    label: 'Google Calendar',
    description: 'Sync your schedule to a workouts calendar',
    // `calendar.app.created` only reaches calendars this app made itself, so we
    // never hold the keys to the rest of someone's calendar.
    scopes: ['https://www.googleapis.com/auth/calendar.app.created'],
  },
  sheets: {
    id: 'sheets',
    label: 'Google Sheets',
    description: 'Export your history to a spreadsheet',
    // `drive.file` is per-file consent: we can create a sheet and keep editing
    // it, and can see nothing else in the user's Drive.
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  },
};

export const GOOGLE_INTEGRATION_LIST = Object.values(GOOGLE_INTEGRATIONS);

/** Tokens as we keep them on the session JWT. */
export interface GoogleTokens {
  accessToken?: string;
  refreshToken?: string;
  /** Unix seconds, as Google reports it. */
  expiresAt?: number;
  /** Everything the user has consented to so far, cumulative across sign-ins. */
  scopes: string[];
}

/** Refresh a little early so a token can't expire mid-request. */
const EXPIRY_SKEW_SECONDS = 60;

export function hasScopes(granted: string[] | undefined, required: string[]): boolean {
  if (!granted) return false;
  return required.every((scope) => granted.includes(scope));
}

/** True when the integration's scopes have all been granted. */
export function isIntegrationConnected(
  granted: string[] | undefined,
  integration: GoogleIntegration
): boolean {
  return hasScopes(granted, integration.scopes);
}

/**
 * The scope string to send when connecting an integration. Google drops any
 * previously granted scope that is missing from the request unless
 * `include_granted_scopes` is set, so we ask for everything we already hold.
 */
export function scopeRequestFor(
  integration: GoogleIntegration,
  granted: string[] = []
): string {
  const scopes = new Set([...GOOGLE_BASE_SCOPES, ...granted, ...integration.scopes]);
  return [...scopes].join(' ');
}

export function isAccessTokenExpired(tokens: GoogleTokens, now: number = Date.now()): boolean {
  if (!tokens.expiresAt) return true;
  return now >= (tokens.expiresAt - EXPIRY_SKEW_SECONDS) * 1000;
}

/** Thrown when the stored refresh token no longer works — the user must sign in again. */
export class GoogleRefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleRefreshError';
  }
}

/**
 * Trades the stored refresh token for a new access token. Google only issues a
 * refresh token on the first consent, so the existing one is carried forward
 * unless the response replaces it.
 */
export async function refreshGoogleTokens(
  tokens: GoogleTokens,
  now: number = Date.now()
): Promise<GoogleTokens> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!tokens.refreshToken) {
    throw new GoogleRefreshError('No refresh token stored for this session');
  }
  if (!clientId || !clientSecret) {
    throw new GoogleRefreshError('AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are not set');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.access_token) {
    throw new GoogleRefreshError(
      `Google refused the refresh token: ${body?.error ?? response.status}`
    );
  }

  return {
    accessToken: body.access_token as string,
    refreshToken: (body.refresh_token as string | undefined) ?? tokens.refreshToken,
    expiresAt: Math.floor(now / 1000) + Number(body.expires_in ?? 3600),
    // A refresh response echoes the granted scopes; fall back to what we knew.
    scopes: typeof body.scope === 'string' ? body.scope.split(' ') : tokens.scopes,
  };
}
