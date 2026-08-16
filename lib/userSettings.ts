/**
 * The settings a user has, as they travel between the browser and the server.
 *
 * This is the wire contract for `GET`/`PUT /api/user`, and it is deliberately a
 * *subset* of `PlannerState`: the things that belong to a person rather than to
 * a browser. `lastViewedMonday` is not here — which week you last looked at is
 * a property of the tab you looked at it in, not of you.
 */

import { z } from 'zod';
import { ActivitySchema, PlannerState } from './types';

export const UserSettingsSchema = z.object({
  /** The `Workouts` calendar this plan lives in. The reason the database exists. */
  googleCalendarId: z.string().nullable(),
  /** ISO, or null while the plan has not been handed to Google Calendar yet. */
  googleAdoptedAt: z.string().nullable(),
  googleSheetId: z.string().nullable(),
  weekStartsOn: z.number().int().min(0).max(6),
  tempUnit: z.enum(['C', 'F']),
  use24HourClock: z.boolean(),
  defaultStartMinutes: z.number().int().min(0).max(1439),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

/** What the server hands back, and what the client pushes up. */
export const UserStateSchema = z.object({
  settings: UserSettingsSchema,
  activities: z.array(ActivitySchema),
  /** Server-incremented; a push carries the revision it was based on. */
  revision: z.number().int(),
  /**
   * True when this read created the row — nobody has ever synced this account.
   *
   * It is what decides the direction of the very first sync: an empty server
   * takes what this browser is holding, and a populated one overwrites it. See
   * `mergeOnFirstPull`.
   */
  isNew: z.boolean(),
});
export type UserState = z.infer<typeof UserStateSchema>;

/** Pull the settings half out of the planner store's state. */
export function settingsFromState(state: PlannerState): UserSettings {
  return {
    googleCalendarId: state.googleCalendarId ?? null,
    googleAdoptedAt: state.googleAdoptedAt ?? null,
    googleSheetId: state.googleSheetId ?? null,
    weekStartsOn: state.weekStartsOn ?? 1,
    tempUnit: state.tempUnit ?? 'F',
    use24HourClock: state.use24HourClock ?? false,
    defaultStartMinutes: state.defaultStartMinutes ?? 7 * 60,
  };
}

/** One comparable string, so an unchanged push is never sent. */
export function settingsSignature(settings: UserSettings): string {
  return JSON.stringify([
    settings.googleCalendarId,
    settings.googleAdoptedAt,
    settings.googleSheetId,
    settings.weekStartsOn,
    settings.tempUnit,
    settings.use24HourClock,
    settings.defaultStartMinutes,
  ]);
}

/** The same, for the activity list — order is meaningful, so it is not sorted. */
export function activitiesSignature(activities: { id: string }[]): string {
  return JSON.stringify(activities);
}

/**
 * What the first sync after signing in on a device should do.
 *
 * The awkward case is the one everybody hits once: a browser with a plan in it,
 * signing in to an account the server has never seen. Taking the server's empty
 * settings would wipe a real plan, so the browser's copy goes up instead.
 *
 * Every other case is the server winning, which is the whole point — a second
 * device is supposed to look like the first, and that includes finding the same
 * calendar rather than making its own.
 *
 * The one thing never taken from an empty server is `googleCalendarId`: a null
 * there means "not asked yet", and letting it overwrite a browser that already
 * knows its calendar is how a duplicate `Workouts` calendar gets made — the
 * exact bug this table exists to stop.
 */
export function mergeOnFirstPull(
  local: { settings: UserSettings; activities: { id: string }[] },
  remote: UserState
): { settings: UserSettings; activities: unknown[]; shouldPush: boolean } {
  if (remote.isNew) {
    return { settings: local.settings, activities: local.activities, shouldPush: true };
  }

  return {
    settings: {
      ...remote.settings,
      // A server that has never been told which calendar to use does not get to
      // unset a browser that knows.
      googleCalendarId: remote.settings.googleCalendarId ?? local.settings.googleCalendarId,
      googleAdoptedAt: remote.settings.googleAdoptedAt ?? local.settings.googleAdoptedAt,
    },
    activities: remote.activities,
    // The merge above may have taught the server something it did not know.
    shouldPush:
      remote.settings.googleCalendarId !== local.settings.googleCalendarId &&
      !remote.settings.googleCalendarId,
  };
}
