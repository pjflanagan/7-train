import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Strava kill switch.
 *
 * Strava moved activity reads behind a paid tier, so a deployment can hold
 * perfectly good credentials and still be unable to read anything. `false`
 * turns the whole integration off without throwing the setup away.
 *
 * The contract this pins is that **one** flag decides it. `isStravaConfigured`
 * is what reaches the client, and every Strava surface gates on that — the
 * integrations tab, the activity form's tab, the sync hook, the routes — so if
 * the switch does not fold into it, the switch is not a single toggle.
 */

const CREDENTIALS = {
  STRAVA_CLIENT_ID: 'id',
  STRAVA_CLIENT_SECRET: 'secret',
  AUTH_SECRET: 'auth-secret',
};

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import('@/lib/stravaServer');
}

const saved = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...saved };
});

describe('the Strava kill switch', () => {
  it('is on by default, when credentials are present', async () => {
    const mod = await load({ ...CREDENTIALS, STRAVA_ENABLED: undefined });
    expect(mod.isStravaEnabled).toBe(true);
    expect(mod.isStravaConfigured).toBe(true);
  });

  it('stays on when set to true', async () => {
    const mod = await load({ ...CREDENTIALS, STRAVA_ENABLED: 'true' });
    expect(mod.isStravaConfigured).toBe(true);
  });

  it('turns the integration off even with credentials present', async () => {
    // The whole point: the credentials stay, so it can be turned back on.
    const mod = await load({ ...CREDENTIALS, STRAVA_ENABLED: 'false' });
    expect(mod.isStravaEnabled).toBe(false);
    expect(mod.isStravaConfigured).toBe(false);
  });

  it('only recognises the exact string "false"', async () => {
    // A half-typed value must not silently disable a working integration.
    for (const value of ['0', 'no', 'False', 'off', '']) {
      const mod = await load({ ...CREDENTIALS, STRAVA_ENABLED: value });
      expect(mod.isStravaEnabled, `${JSON.stringify(value)} should not disable`).toBe(true);
    }
  });

  it('is still off when the credentials are missing', async () => {
    const mod = await load({
      STRAVA_CLIENT_ID: undefined,
      STRAVA_CLIENT_SECRET: undefined,
      AUTH_SECRET: 'auth-secret',
      STRAVA_ENABLED: 'true',
    });
    expect(mod.isStravaEnabled).toBe(true);
    expect(mod.isStravaConfigured).toBe(false);
  });
});
