import { HistoryEntry, Activity, ScheduledEvent } from './types';
import { dayLabel, dateForDay, formatDateLocal, WeekStartsOn } from './dates';
import { DAYS } from './constants';
import { activitiesForWeek, WeekActivities } from './progress';
import { buildActivitySnapshot, resolveEventActivity } from './activitySnapshot';

/**
 * Flatten scheduled events into dated rows.
 *
 * Weeks are stored against real dates and kept indefinitely, so the schedule
 * itself is the record — `history` only holds rows imported from the old
 * archive-on-rollover format.
 *
 * A note is a column of the workout it belongs to, since that is where notes
 * live. The day-note rows this used to emit — a dated row with no workout on
 * it, carrying the note for a rest day — have nothing to stand for any more.
 */
export function entriesFromSchedule(
  events: ScheduledEvent[],
  weekStartsOn: WeekStartsOn = 1,
  weekActivities?: WeekActivities
): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const weekStarts = new Set(events.map(i => i.weekStart));

  weekStarts.forEach(weekStart => {
    DAYS.forEach(day => {
      const date = formatDateLocal(dateForDay(weekStart, day, weekStartsOn));

      events
        .filter(i => i.weekStart === weekStart && i.day === day)
        .forEach(event => {
          entries.push({
            id: `sched-${event.id}`,
            date,
            day,
            typeId: event.typeId,
            workoutType: event.workoutType || null,
            value: event.value,
            notes: event.note || null,
            // Each week names its activities itself, so a row carries what its
            // own week called it rather than trusting a shared lookup later.
            activitySnapshot:
              event.activitySnapshot ??
              (() => {
                const activity = resolveEventActivity(
                  event,
                  activitiesForWeek(event.weekStart, weekActivities)
                );
                return activity ? buildActivitySnapshot(activity) : undefined;
              })()
          });
        });
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
      const snapshot = event.activitySnapshot;
      const type = snapshot ? null : (event.typeId ? types.find(t => t.id === event.typeId) : null);
      return [
        event.date,
        dayLabel(event.day),
        type ? type.name : (snapshot?.name ?? event.typeId ?? ''),
        event.workoutType || '',
        event.value !== null && event.value !== undefined ? String(event.value) : '',
        type ? type.unit : (snapshot?.unit ?? ''),
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
    const snapshot = event.activitySnapshot;
    const type = snapshot ? null : (event.typeId ? types.find(t => t.id === event.typeId) : null);
    const categoryName = type ? type.name : (snapshot?.name ?? event.typeId ?? '');
    const unit = type ? type.unit : (snapshot?.unit ?? '');
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
