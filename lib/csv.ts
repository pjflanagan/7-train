import { HistoryEntry, WorkoutType, CalendarItem } from './types';
import { dayLabel, dateForDay, formatDateLocal, WeekStartsOn } from './dates';
import { DAYS } from './constants';

/**
 * Flatten scheduled items and day notes into dated rows.
 *
 * Weeks are stored against real dates and kept indefinitely, so the schedule
 * itself is the record — `history` only holds rows imported from the old
 * archive-on-rollover format.
 */
export function entriesFromSchedule(
  items: CalendarItem[],
  notes: Record<string, string>,
  weekStartsOn: WeekStartsOn = 1
): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const weekStarts = new Set(items.map(i => i.weekStart));
  Object.keys(notes).forEach(key => {
    const weekStart = key.slice(0, 10);
    if (weekStart) weekStarts.add(weekStart);
  });

  weekStarts.forEach(weekStart => {
    DAYS.forEach(day => {
      const date = formatDateLocal(dateForDay(weekStart, day, weekStartsOn));
      const note = notes[`${weekStart}-${day}`] || null;
      const dayItems = items.filter(i => i.weekStart === weekStart && i.day === day);

      if (dayItems.length > 0) {
        dayItems.forEach(item => {
          entries.push({
            id: `sched-${item.id}`,
            date,
            day,
            typeId: item.typeId,
            workoutType: item.workoutType || null,
            value: item.value,
            notes: note
          });
        });
      } else if (note) {
        entries.push({
          id: `sched-note-${weekStart}-${day}`,
          date,
          day,
          typeId: null,
          workoutType: null,
          value: null,
          notes: note
        });
      }
    });
  });

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export function exportCsv(history: HistoryEntry[], types: WorkoutType[]): string {
  const headers = ["Date", "Day", "Workout Category", "Workout Type/Subtype", "Value", "Unit", "Notes"];

  function escapeCSV(val: string | number | null | undefined): string {
    if (val === null || val === undefined) {
      return '';
    }
    let str = String(val);
    if (/[",\n\r]/.test(str)) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  const csvRows = [headers.join(",")];

  history.forEach(item => {
    const type = item.typeId ? types.find(t => t.id === item.typeId) : null;
    const categoryName = type ? type.name : (item.typeId || '');
    const unit = type ? type.unit : '';
    const dayNameCap = dayLabel(item.day);

    const row = [
      item.date,
      dayNameCap,
      categoryName,
      item.workoutType || '',
      item.value !== null ? item.value : '',
      unit,
      item.notes || ''
    ];

    csvRows.push(row.map(escapeCSV).join(","));
  });

  return csvRows.join("\n");
}
