import { useCallback } from 'react';
import { usePlannerStore } from '@/lib/store';
import { exportCsv, entriesFromSchedule } from '@/lib/csv';
import { WeekStartsOn } from '@/lib/dates';

export function useCsvExport() {
  const history = usePlannerStore(state => state.history);
  const events = usePlannerStore(state => state.events);
  const notes = usePlannerStore(state => state.notes);
  const weekStartsOn = usePlannerStore(state => state.weekStartsOn);
  const activities = usePlannerStore(state => state.activities);

  const exportData = useCallback(() => {
    // Legacy archived rows first, then everything currently on the calendar.
    const scheduled = entriesFromSchedule(events, notes, (weekStartsOn ?? 1) as WeekStartsOn);
    const rows = [...history, ...scheduled].sort((a, b) => a.date.localeCompare(b.date));

    const csvContent = exportCsv(rows, activities);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;

    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `workout_history_${dateStr}.csv`);

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [history, events, notes, weekStartsOn, activities]);

  return { exportData };
}
