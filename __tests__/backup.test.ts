import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, parseBackup, serializeBackup, toBackup } from '@/lib/backup';
import { usePlannerStore } from '@/lib/store';

const state = usePlannerStore.getState();

describe('backup', () => {
  it('is stamped with the version the store is on', async () => {
    // Drift here means a fresh export claims to be older than it is, and gets
    // needlessly re-migrated on the way back in.
    const persisted = usePlannerStore.persist.getOptions().version ?? 0;
    expect(BACKUP_VERSION).toBe(persisted);
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
