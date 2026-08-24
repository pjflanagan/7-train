import { PlannerState, PlannerStateSchema } from './types';
import { CURRENT_STATE_VERSION, migrateStore } from './migrate';

/**
 * The shape an export is stamped with, and the one `parseBackup` migrates
 * *from*. It is the migration chain's own version rather than a second number
 * kept in step by hand — letting it drift behind means fresh exports get
 * needlessly re-migrated on the way back in.
 */
export const BACKUP_VERSION = CURRENT_STATE_VERSION;

const BACKUP_FORMAT = 'workout-week-backup';

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /**
   * `googleCalendarName` is deliberately not in here. It is a cache of what
   * Google calls the calendar, refreshed by every pull, so backing it up would
   * only preserve a name that may since have changed. A restore leaves it null
   * and the first pull fills it in.
   */
  state: Omit<PlannerState, 'googleCalendarName'>;
};

/** Strip the store's action functions, keeping only the persisted data. */
export function toBackup(state: PlannerState): Backup {
  const {
    activities, events, weekActivities, links, history, lastViewedMonday, tempUnit,
    use24HourClock, weekStartsOn, defaultStartMinutes, googleCalendarId, googleAdoptedAt,
    googleSheetId
  } = state;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    // The Google ids ride along so a restore onto the same account picks the
    // existing calendar and spreadsheet back up instead of making new ones.
    state: {
      activities, events, weekActivities, links, history, lastViewedMonday, tempUnit,
      use24HourClock, weekStartsOn, defaultStartMinutes, googleCalendarId, googleAdoptedAt,
      googleSheetId
    }
  };
}

export function serializeBackup(state: PlannerState): string {
  return JSON.stringify(toBackup(state), null, 2);
}

export class BackupParseError extends Error {}

/**
 * Parse a backup file back into planner state.
 *
 * Older files are run through the same `migrate` path the persisted store
 * uses, so a backup taken on the old domain imports cleanly here.
 */
export function parseBackup(text: string): PlannerState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupParseError('That file is not valid JSON.');
  }

  if (!raw || typeof raw !== 'object') {
    throw new BackupParseError('That file is not a workout backup.');
  }

  const envelope = raw as Record<string, unknown>;

  // Accept both a wrapped backup and a bare `{ state, version }` blob, which is
  // what zustand used to write to `localStorage` and what a hand-copied export
  // from that era looks like.
  const hasState = envelope.state && typeof envelope.state === 'object';
  if (!hasState) {
    throw new BackupParseError('That file is not a workout backup.');
  }

  const version = typeof envelope.version === 'number' ? envelope.version : 1;
  const migrated = migrateStore(envelope.state, version);

  const result = PlannerStateSchema.safeParse(migrated);
  if (!result.success) {
    throw new BackupParseError('That backup is missing or has invalid data.');
  }
  return result.data;
}
