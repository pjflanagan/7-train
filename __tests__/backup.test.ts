import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, parseBackup, serializeBackup, toBackup } from '@/lib/backup';
import { CURRENT_STATE_VERSION } from '@/lib/migrate';
import { usePlannerStore } from '@/lib/store';

const state = usePlannerStore.getState();

describe('backup', () => {
  it('is stamped with the version the migration chain produces', () => {
    // Drift here means a fresh export claims to be older than it is, and gets
    // needlessly re-migrated on the way back in.
    expect(BACKUP_VERSION).toBe(CURRENT_STATE_VERSION);
  });

  it('leaves the cached calendar name out, and restores it as null', () => {
    const backup = toBackup({ ...state, googleCalendarName: 'Marathon block' });
    expect('googleCalendarName' in backup.state).toBe(false);

    const restored = parseBackup(serializeBackup({ ...state, googleCalendarName: 'X' }));
    expect(restored.googleCalendarName).toBeNull();
  });

  it('keeps the calendar id, which a restore does need', () => {
    const restored = parseBackup(
      serializeBackup({ ...state, googleCalendarId: 'abc@group.calendar.google.com' })
    );
    expect(restored.googleCalendarId).toBe('abc@group.calendar.google.com');
  });
});
