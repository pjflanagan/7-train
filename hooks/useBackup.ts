import { useCallback } from 'react';
import { usePlannerStore } from '@/lib/store';
import { serializeBackup, parseBackup, BackupParseError } from '@/lib/backup';

export function useBackup() {
  const replaceAll = usePlannerStore(state => state.replaceAll);

  const exportBackup = useCallback(() => {
    const json = serializeBackup(usePlannerStore.getState());
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;

    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `workout_backup_${dateStr}.json`);

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  /** Resolves to an error message, or null when the import succeeded. */
  const importBackup = useCallback(async (file: File): Promise<string | null> => {
    try {
      replaceAll(parseBackup(await file.text()));
      return null;
    } catch (error) {
      if (error instanceof BackupParseError) return error.message;
      return 'Could not read that file.';
    }
  }, [replaceAll]);

  return { exportBackup, importBackup };
}
