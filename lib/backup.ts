import { PlannerState, PlannerStateSchema } from './types';
import { migrateStore } from './migrate';

/** Bumped alongside the zustand `persist` version in `@/lib/store`. */
export const BACKUP_VERSION = 3;

const BACKUP_FORMAT = 'workout-week-backup';

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  state: PlannerState;
};

/** Strip the store's action functions, keeping only the persisted data. */
export function toBackup(state: PlannerState): Backup {
  const {
    activities, events, notes, weeklyTargets, links, history, lastViewedMonday, tempUnit,
    weekStartsOn, defaultStartMinutes, googleCalendarId, googleSheetId
  } = state;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    // The Google ids ride along so a restore onto the same account picks the
    // existing calendar and spreadsheet back up instead of making new ones.
    state: {
      activities, events, notes, weeklyTargets, links, history, lastViewedMonday, tempUnit,
      weekStartsOn, defaultStartMinutes, googleCalendarId, googleSheetId
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

  // Accept both a wrapped backup and a bare `localStorage` blob, which zustand
  // writes as `{ state, version }` — that is what a hand-copied export looks like.
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
