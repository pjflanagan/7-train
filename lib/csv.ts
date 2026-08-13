import { HistoryEntry, Activity, ScheduledEvent } from './types';
import { dayLabel, dateForDay, formatDateLocal, WeekStartsOn } from './dates';
import { DAYS } from './constants';

/**
 * Flatten scheduled events and day notes into dated rows.
 *
 * Weeks are stored against real dates and kept indefinitely, so the schedule
 * itself is the record — `history` only holds rows imported from the old
 * archive-on-rollover format.
 */
export function entriesFromSchedule(
  events: ScheduledEvent[],
  notes: Record<string, string>,
  weekStartsOn: WeekStartsOn = 1
): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const weekStarts = new Set(events.map(i => i.weekStart));
  Object.keys(notes).forEach(key => {
    const weekStart = key.slice(0, 10);
    if (weekStart) weekStarts.add(weekStart);
  });

  weekStarts.forEach(weekStart => {
    DAYS.forEach(day => {
      const date = formatDateLocal(dateForDay(weekStart, day, weekStartsOn));
      const note = notes[`${weekStart}-${day}`] || null;
      const dayEvents = events.filter(i => i.weekStart === weekStart && i.day === day);

      if (dayEvents.length > 0) {
        dayEvents.forEach(event => {
          entries.push({
            id: `sched-${event.id}`,
            date,
            day,
            typeId: event.typeId,
            workoutType: event.workoutType || null,
            value: event.value,
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

const HEADERS = ["Date", "Day", "Workout Category", "Workout Type/Subtype", "Value", "Unit", "Notes"];

/**
 * History as a grid of strings, header row first. Shared by the CSV download
 * and the Sheets export so both records say exactly the same thing.
 */
export function historyRows(history: HistoryEntry[], types: Activity[]): string[][] {
  return [
    HEADERS,
    ...history.map(event => {
      const type = event.typeId ? types.find(t => t.id === event.typeId) : null;
      return [
        event.date,
        dayLabel(event.day),
        type ? type.name : (event.typeId || ''),
        event.workoutType || '',
        event.value !== null && event.value !== undefined ? String(event.value) : '',
        type ? type.unit : '',
        event.notes || ''
      ];
    })
  ];
}

export function exportCsv(history: HistoryEntry[], types: Activity[]): string {
  const headers = HEADERS;

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

  history.forEach(event => {
    const type = event.typeId ? types.find(t => t.id === event.typeId) : null;
    const categoryName = type ? type.name : (event.typeId || '');
    const unit = type ? type.unit : '';
    const dayNameCap = dayLabel(event.day);

    const row = [
      event.date,
      dayNameCap,
      categoryName,
      event.workoutType || '',
      event.value !== null ? event.value : '',
      unit,
      event.notes || ''
    ];

    csvRows.push(row.map(escapeCSV).join(","));
  });

  return csvRows.join("\n");
}
