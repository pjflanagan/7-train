import { HistoryEntry, WorkoutType } from './types';
import { dayLabel } from './dates';

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
