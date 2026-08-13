import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  GOOGLE_INTEGRATIONS,
  GoogleRefreshError,
  hasScopes,
  isAccessTokenExpired,
  isIntegrationConnected,
  refreshGoogleTokens,
  scopeRequestFor,
} from '@/lib/google';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('hasScopes', () => {
  it('needs every required scope, not just one', () => {
    expect(hasScopes(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(hasScopes(['a'], ['a', 'b'])).toBe(false);
  });

  it('is satisfied by an empty requirement', () => {
    expect(hasScopes([], [])).toBe(true);
  });

  it('treats an unknown grant as no grant', () => {
    expect(hasScopes(undefined, ['a'])).toBe(false);
  });
});

describe('isIntegrationConnected', () => {
  it('reads the calendar grant off the granted scopes', () => {
    expect(isIntegrationConnected([CALENDAR_SCOPE], GOOGLE_INTEGRATIONS.calendar)).toBe(true);
    expect(isIntegrationConnected(['openid'], GOOGLE_INTEGRATIONS.calendar)).toBe(false);
  });
});

describe('scopeRequestFor', () => {
  it('keeps the scopes already granted so Google does not drop them', () => {
    const request = scopeRequestFor(GOOGLE_INTEGRATIONS.sheets, ['openid', CALENDAR_SCOPE]);
    expect(request.split(' ')).toContain(CALENDAR_SCOPE);
    expect(request.split(' ')).toContain(GOOGLE_INTEGRATIONS.sheets.scopes[0]);
  });

  it('never repeats a scope', () => {
    const scopes = scopeRequestFor(GOOGLE_INTEGRATIONS.calendar, ['openid', 'email']).split(' ');
    expect(new Set(scopes).size).toBe(scopes.length);
  });
});

describe('isAccessTokenExpired', () => {
  const now = 1_700_000_000_000; // ms
  const nowSeconds = now / 1000;

  it('is expired when there is no expiry to trust', () => {
    expect(isAccessTokenExpired({ scopes: [] }, now)).toBe(true);
  });

  it('is live while there is more than the refresh skew left', () => {
    expect(isAccessTokenExpired({ scopes: [], expiresAt: nowSeconds + 120 }, now)).toBe(false);
  });

  it('expires early, inside the skew, so a request cannot outlive the token', () => {
    expect(isAccessTokenExpired({ scopes: [], expiresAt: nowSeconds + 30 }, now)).toBe(true);
  });

  it('is expired once the expiry has passed', () => {
    expect(isAccessTokenExpired({ scopes: [], expiresAt: nowSeconds - 1 }, now)).toBe(true);
  });
});

describe('refreshGoogleTokens', () => {
  const now = 1_700_000_000_000;
  const stored = { refreshToken: 'refresh-1', accessToken: 'old', scopes: ['openid'] };

  const stubEnv = () => {
    vi.stubEnv('AUTH_GOOGLE_ID', 'client-id');
    vi.stubEnv('AUTH_GOOGLE_SECRET', 'client-secret');
  };

  it('swaps the refresh token for a fresh access token', async () => {
    stubEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          expires_in: 3599,
          scope: `openid ${CALENDAR_SCOPE}`,
        }),
      })
    );

    const tokens = await refreshGoogleTokens(stored, now);

    expect(tokens.accessToken).toBe('new-access');
    expect(tokens.expiresAt).toBe(now / 1000 + 3599);
    expect(tokens.scopes).toEqual(['openid', CALENDAR_SCOPE]);
  });

  it('carries the old refresh token forward when Google omits a new one', async () => {
    stubEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-access', expires_in: 3600 }),
      })
    );

    const tokens = await refreshGoogleTokens(stored, now);

    expect(tokens.refreshToken).toBe('refresh-1');
    // No scope echoed back means the grant is unchanged, not empty.
    expect(tokens.scopes).toEqual(['openid']);
  });

  it('reports a revoked grant instead of returning a dead token', async () => {
    stubEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant' }),
      })
    );

    await expect(refreshGoogleTokens(stored, now)).rejects.toBeInstanceOf(GoogleRefreshError);
  });

  it('does not call Google without a refresh token', async () => {
    stubEnv();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(refreshGoogleTokens({ scopes: [] }, now)).rejects.toBeInstanceOf(
      GoogleRefreshError
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
