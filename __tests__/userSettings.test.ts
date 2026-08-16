import { describe, expect, it } from 'vitest';
import {
  UserSettings,
  UserState,
  mergeOnFirstPull,
  settingsFromState,
  settingsSignature,
} from '@/lib/userSettings';
import { PlannerState } from '@/lib/types';

const localSettings: UserSettings = {
  googleCalendarId: 'local@group.calendar.google.com',
  googleAdoptedAt: '2026-08-01T00:00:00.000Z',
  googleSheetId: null,
  weekStartsOn: 1,
  tempUnit: 'F',
  use24HourClock: false,
  defaultStartMinutes: 7 * 60,
};

function remote(overrides: Partial<UserState> = {}): UserState {
  return {
    settings: {
      googleCalendarId: 'server@group.calendar.google.com',
      googleAdoptedAt: '2026-07-01T00:00:00.000Z',
      googleSheetId: 'sheet-1',
      weekStartsOn: 0,
      tempUnit: 'C',
      use24HourClock: true,
      defaultStartMinutes: 18 * 60,
    },
    activities: [],
    revision: 4,
    isNew: false,
    ...overrides,
  };
}

const local = { settings: localSettings, activities: [{ id: 'run' }] };

describe('settingsFromState', () => {
  it('takes only what belongs to the person, not to the browser', () => {
    const state = {
      googleCalendarId: 'abc',
      googleAdoptedAt: null,
      googleSheetId: null,
      weekStartsOn: 0,
      tempUnit: 'C',
      use24HourClock: true,
      defaultStartMinutes: 400,
      lastViewedMonday: '2026-08-10',
    } as unknown as PlannerState;

    const settings = settingsFromState(state);

    expect(settings.googleCalendarId).toBe('abc');
    expect(settings.weekStartsOn).toBe(0);
    // Which week you last looked at is a property of the tab, not of you.
    expect('lastViewedMonday' in settings).toBe(false);
  });

  it('fills in defaults for a store written before a setting existed', () => {
    const settings = settingsFromState({} as PlannerState);

    expect(settings.weekStartsOn).toBe(1);
    expect(settings.tempUnit).toBe('F');
    expect(settings.defaultStartMinutes).toBe(7 * 60);
    expect(settings.googleCalendarId).toBeNull();
  });
});

describe('mergeOnFirstPull', () => {
  it('uploads this browser’s plan when the account has never synced', () => {
    const merged = mergeOnFirstPull(local, remote({ isNew: true }));

    expect(merged.shouldPush).toBe(true);
    expect(merged.settings).toEqual(localSettings);
    expect(merged.activities).toEqual(local.activities);
  });

  it('lets the server win on a device that is joining an existing account', () => {
    const merged = mergeOnFirstPull(local, remote());

    expect(merged.settings.weekStartsOn).toBe(0);
    expect(merged.settings.tempUnit).toBe('C');
    expect(merged.settings.googleSheetId).toBe('sheet-1');
    expect(merged.shouldPush).toBe(false);
  });

  it('brings a second device to the same calendar, which is the whole point', () => {
    const freshBrowser = { settings: { ...localSettings, googleCalendarId: null }, activities: [] };
    const merged = mergeOnFirstPull(freshBrowser, remote());

    expect(merged.settings.googleCalendarId).toBe('server@group.calendar.google.com');
  });

  it('never lets an unanswered server unset a calendar this browser knows', () => {
    // The bug this table exists to stop: a null here used to mean "make a new
    // calendar", and that is how a plan ended up split across two of them.
    const merged = mergeOnFirstPull(
      local,
      remote({ settings: { ...remote().settings, googleCalendarId: null } })
    );

    expect(merged.settings.googleCalendarId).toBe('local@group.calendar.google.com');
    // And the server gets told, so the next device does not have to guess.
    expect(merged.shouldPush).toBe(true);
  });

  it('keeps the local adoption stamp when the server has none', () => {
    // Losing it would make the next sync re-upload every week as if the plan
    // had never been handed over.
    const merged = mergeOnFirstPull(
      local,
      remote({ settings: { ...remote().settings, googleAdoptedAt: null } })
    );

    expect(merged.settings.googleAdoptedAt).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('settingsSignature', () => {
  it('does not change when nothing did, so an idle tab never writes', () => {
    expect(settingsSignature(localSettings)).toBe(settingsSignature({ ...localSettings }));
  });

  it('changes when a setting does', () => {
    expect(settingsSignature(localSettings)).not.toBe(
      settingsSignature({ ...localSettings, weekStartsOn: 0 })
    );
  });
});
