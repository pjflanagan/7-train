import { PlannerState, CalendarItem, HistoryEntry } from './types';
import { DAYS } from './constants';
import { getMonday, formatDateLocal, dayIndex } from './dates';

export function computeRollover(state: PlannerState, today: Date): PlannerState {
  const mondayDate = getMonday(today);
  const currentMondayStr = formatDateLocal(mondayDate);
  const lastViewedMonday = state.lastViewedMonday;

  if (!lastViewedMonday) {
    return { ...state, lastViewedMonday: currentMondayStr };
  }

  if (lastViewedMonday === currentMondayStr) {
    return state;
  }

  const lastDate = new Date(lastViewedMonday + 'T00:00:00');
  const currDate = new Date(currentMondayStr + 'T00:00:00');
  const diffTime = currDate.getTime() - lastDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const weeksPassed = Math.round(diffDays / 7);

  if (weeksPassed <= 0) {
    return { ...state, lastViewedMonday: currentMondayStr };
  }

  const history: HistoryEntry[] = [...state.history];

  for (let i = 0; i < weeksPassed; i++) {
    const archiveMonday = new Date(lastDate);
    archiveMonday.setDate(lastDate.getDate() + (i * 7));

    const activeWeekNum = i + 1;

    if (activeWeekNum === 1 || activeWeekNum === 2) {
      DAYS.forEach(day => {
        const dayItems = state.items.filter(item => item.day === day && item.week === activeWeekNum);
        const noteText = state.notes[`${day}-${activeWeekNum}`] || "";

        if (dayItems.length > 0) {
          dayItems.forEach(item => {
            const dayOffset = dayIndex(day);
            const itemDate = new Date(archiveMonday);
            itemDate.setDate(archiveMonday.getDate() + dayOffset);

            history.push({
              id: 'hist-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
              date: formatDateLocal(itemDate),
              day: day,
              typeId: item.typeId,
              workoutType: item.workoutType || null,
              value: item.value,
              notes: noteText || null
            });
          });
        } else if (noteText) {
          const dayOffset = dayIndex(day);
          const itemDate = new Date(archiveMonday);
          itemDate.setDate(archiveMonday.getDate() + dayOffset);

          history.push({
            id: 'hist-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            date: formatDateLocal(itemDate),
            day: day,
            typeId: null,
            workoutType: null,
            value: null,
            notes: noteText
          });
        }
      });
    }
  }

  let updatedItems: CalendarItem[] = [];
  let updatedNotes: Record<string, string> = {};

  if (weeksPassed === 1) {
    // shift week 2 to week 1
    updatedItems = state.items
      .filter(item => item.week === 2)
      .map(item => ({ ...item, week: 1 }));
    
    Object.keys(state.notes).forEach(key => {
      const [day, week] = key.split('-');
      if (week === '2') {
        updatedNotes[`${day}-1`] = state.notes[key];
      }
    });
  } else {
    // weeksPassed >= 2, empty out everything
    updatedItems = [];
    updatedNotes = {};
  }

  return {
    ...state,
    items: updatedItems,
    notes: updatedNotes,
    history,
    lastViewedMonday: currentMondayStr
  };
}
