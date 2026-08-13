import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlannerState, Activity, ScheduledEvent, HelpfulLink } from './types';
import { DEFAULT_ACTIVITIES, getDefaultEvents, DEFAULT_LINKS, DAYS } from './constants';
import { importLegacy, migrateStore } from './migrate';
import { getWeekStartKey, WeekStartsOn } from './dates';
import { weeklyTargetKey } from './progress';
import {
  byStartTime,
  clampDuration,
  clampStartMinutes,
  DEFAULT_START_MINUTES,
  durationMinutesOf,
  SLOT_MINUTES,
  startMinutesOf
} from './schedule';
import { arrayMove } from '@dnd-kit/sortable';

type DayName = typeof DAYS[number];

export const noteKey = (weekStart: string, day: DayName) => `${weekStart}-${day}`;

type PlannerStore = PlannerState & {
  addActivity: (activity: Activity) => void;
  updateActivity: (id: string, activity: Partial<Activity>) => void;
  deleteActivity: (id: string) => void;
  reorderActivities: (oldIndex: number, newIndex: number) => void;
  /** Bends an activity's target for one week only; the baseline `target` is untouched. */
  setActivityTarget: (id: string, target: number, weekStart: string) => void;

  addEvent: (event: Omit<ScheduledEvent, 'id'>) => void;
  updateEventValue: (id: string, value: number) => void;
  setEventSubType: (id: string, subType: string | null) => void;
  removeEvent: (id: string) => void;
  moveEvent: (id: string, targetDay: DayName, targetWeekStart: string, newIndex?: number) => void;
  reorderDay: (day: DayName, weekStart: string, oldIndex: number, newIndex: number) => void;
  /** Move an event through the day. Minutes from local midnight, snapped to 15. */
  setEventTime: (id: string, startMinutes: number) => void;
  /** Nudge a time by whole slots, the keyboard equivalent of dragging it. */
  nudgeEventTime: (id: string, slots: number) => void;
  /** Set how long an event runs. Minutes, snapped to 15. */
  setEventDuration: (id: string, durationMinutes: number) => void;
  /** Stretch or shrink a duration by whole slots, for the keyboard. */
  nudgeEventDuration: (id: string, slots: number) => void;

  setGoogleCalendarId: (calendarId: string | null) => void;
  setGoogleSheetId: (sheetId: string | null) => void;
  /** Record which Google event now mirrors each event, keyed by event id. */
  setGoogleEventIds: (eventIds: Record<string, string>) => void;
  /**
   * Swap the whole schedule for what Google Calendar holds. Activities, notes and
   * settings stay put: the calendar owns events only.
   */
  replaceEvents: (events: ScheduledEvent[]) => void;

  setNote: (day: DayName, weekStart: string, note: string) => void;
  /**
   * Pull another week into this one. The schedule (workouts and day notes) and
   * the activity targets are copied independently, so a week can inherit one
   * without the other. Whichever part is copied overwrites what was there.
   */
  copyWeek: (
    fromWeekStart: string,
    toWeekStart: string,
    parts?: { schedule?: boolean; activities?: boolean }
  ) => void;
  clearWeek: (weekStart: string) => void;

  addLink: (link: HelpfulLink) => void;
  removeLink: (id: string) => void;

  setTempUnit: (unit: 'C' | 'F') => void;
  setUse24HourClock: (use24Hour: boolean) => void;
  setWeekStartsOn: (weekStartsOn: WeekStartsOn) => void;
  /** Where a new workout lands on an otherwise empty day. */
  setDefaultStartMinutes: (startMinutes: number) => void;
  /** Replace every persisted field at once, used by backup import. */
  replaceAll: (state: PlannerState) => void;
  resetAll: () => void;
  /** Wipes everything to a blank slate — no seeded activities or events, unlike `resetAll`. */
  clearAll: () => void;
};

function buildInitialState(): PlannerState {
  const weekStart = getWeekStartKey(new Date(), 1);
  return {
    activities: DEFAULT_ACTIVITIES,
    events: getDefaultEvents(weekStart),
    notes: {},
    weeklyTargets: {},
    links: DEFAULT_LINKS,
    history: [],
    lastViewedMonday: null,
    tempUnit: 'F',
    use24HourClock: false,
    weekStartsOn: 1,
    defaultStartMinutes: DEFAULT_START_MINUTES,
    googleCalendarId: null,
    googleSheetId: null,
  };
}

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

/**
 * Where a newly dropped workout lands: straight after the last one already on
 * that day, or the default morning slot when the day is empty.
 */
function nextFreeSlot(state: PlannerState, day: DayName, weekStart: string): number {
  const defaultStart = clampStartMinutes(state.defaultStartMinutes ?? DEFAULT_START_MINUTES);
  const dayEvents = state.events.filter(i => i.day === day && i.weekStart === weekStart);
  if (dayEvents.length === 0) return defaultStart;

  const latestEnd = dayEvents.reduce((end, event) => {
    const activity = state.activities.find(g => g.id === event.typeId);
    return Math.max(end, startMinutesOf(event) + durationMinutesOf(event, activity));
  }, defaultStart);

  return clampStartMinutes(latestEnd);
}

/** The moment a workout finishes: its start plus however long it runs. */
function endOf(state: PlannerState, event: ScheduledEvent): number {
  const activity = state.activities.find(g => g.id === event.typeId);
  return startMinutesOf(event) + durationMinutesOf(event, activity);
}

/**
 * The time a workout takes when it is dropped into a day at `index`.
 *
 * Dropping something after another workout means exactly that: it starts when
 * that one ends. Nothing else on the day moves — the workouts it was dropped
 * between keep the times they were given.
 *
 * `ordered` is the day already in its new order, the dragged workout included.
 */
function startAtIndex(state: PlannerState, ordered: ScheduledEvent[], index: number): number {
  const previous = ordered[index - 1];
  if (previous) return clampStartMinutes(endOf(state, previous));

  // Dropped at the top of the day: it only has to be no later than what now
  // follows it, so a workout dragged up there keeps its own earlier time.
  const moved = ordered[index];
  const next = ordered[index + 1];
  if (!next) return startMinutesOf(moved);
  return Math.min(startMinutesOf(moved), startMinutesOf(next));
}

/**
 * Mark an event as edited now. Everything that changes what the workout *is*
 * goes through here, so a future merge against an integration can compare
 * timestamps and keep the newer side.
 */
function stamp(event: ScheduledEvent): ScheduledEvent {
  return { ...event, updatedAt: new Date().toISOString() };
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set) => ({
      ...buildInitialState(),

      addActivity: (activity) => set((state) => ({ activities: [...state.activities, activity] })),
      updateActivity: (id, updates) => set((state) => {
        const current = state.activities.find(g => g.id === id);
        const targetChanged = !!current && 'target' in updates && Number(updates.target) !== Number(current.target);
        const metricChanged = !!current && 'metric' in updates && updates.metric !== current.metric;

        // A changed default must not reshape weeks that already exist: every
        // week without its own override gets the old baseline pinned down
        // before the activity picks up its new one, so only weeks that don't
        // exist yet ever see the new default.
        let weeklyTargets = state.weeklyTargets;
        if (current && (targetChanged || metricChanged)) {
          const weekStarts = new Set<string>();
          state.events.forEach(e => weekStarts.add(e.weekStart));
          Object.keys(weeklyTargets || {}).forEach(key => weekStarts.add(key.split(':')[0]));

          const pinned = { ...(weeklyTargets || {}) };
          let changed = false;
          weekStarts.forEach(weekStart => {
            const key = weeklyTargetKey(weekStart, id);
            if (pinned[key] === undefined) {
              pinned[key] = Number(current.target) || 0;
              changed = true;
            }
          });
          if (changed) weeklyTargets = pinned;
        }

        return {
          activities: state.activities.map(g => g.id === id ? { ...g, ...updates } : g),
          weeklyTargets
        };
      }),
      deleteActivity: (id) => set((state) => {
        const weeklyTargets = { ...(state.weeklyTargets || {}) };
        Object.keys(weeklyTargets).forEach(key => {
          if (key.endsWith(`:${id}`)) delete weeklyTargets[key];
        });
        return {
          activities: state.activities.filter(g => g.id !== id),
          events: state.events.filter(i => i.typeId !== id),
          weeklyTargets
        };
      }),
      reorderActivities: (oldIndex, newIndex) => set((state) => ({
        activities: arrayMove(state.activities, oldIndex, newIndex)
      })),
      setActivityTarget: (id, target, weekStart) => set((state) => {
        const key = weeklyTargetKey(weekStart, id);
        const activity = state.activities.find(g => g.id === id);
        const weeklyTargets = { ...(state.weeklyTargets || {}) };
        // Back at the baseline there is nothing to remember, so drop the
        // override and let the week follow the activity again.
        if (activity && (Number(activity.target) || 0) === target) {
          delete weeklyTargets[key];
        } else {
          weeklyTargets[key] = target;
        }
        return { weeklyTargets };
      }),

      addEvent: (event) => set((state) => ({
        events: [
          ...state.events,
          stamp({
            ...event,
            id: newId('event'),
            startMinutes: event.startMinutes ?? nextFreeSlot(state, event.day, event.weekStart)
          })
        ]
      })),
      updateEventValue: (id, value) => set((state) => ({
        events: state.events.map(i => i.id === id ? stamp({ ...i, value }) : i)
      })),
      setEventSubType: (id, subType) => set((state) => ({
        events: state.events.map(i => i.id === id ? stamp({ ...i, workoutType: subType }) : i)
      })),
      removeEvent: (id) => set((state) => ({
        events: state.events.filter(i => i.id !== id)
      })),
      moveEvent: (id, targetDay, targetWeekStart, newIndex) => set((state) => {
        const event = state.events.find(i => i.id === id);
        if (!event) return state;

        let newEvents = state.events.filter(i => i.id !== id);
        const updatedEvent: ScheduledEvent = stamp({
          ...event,
          day: targetDay,
          weekStart: targetWeekStart
        });

        if (newIndex !== undefined) {
          const inTarget = (i: ScheduledEvent) =>
            i.day === targetDay && i.weekStart === targetWeekStart;
          const targetDayEvents = byStartTime(newEvents.filter(inTarget));
          targetDayEvents.splice(newIndex, 0, updatedEvent);
          // Dropped after a workout, so it starts when that one ends; the rest
          // of the day is left where it was.
          updatedEvent.startMinutes = startAtIndex(state, targetDayEvents, newIndex);
          newEvents = [...newEvents.filter(i => !inTarget(i)), ...targetDayEvents];
        } else {
          newEvents.push(updatedEvent);
        }

        return { events: newEvents };
      }),
      reorderDay: (day, weekStart, oldIndex, newIndex) => set((state) => {
        const inDay = (i: ScheduledEvent) => i.day === day && i.weekStart === weekStart;
        const dayEvents = byStartTime(state.events.filter(inDay));
        const otherEvents = state.events.filter(i => !inDay(i));

        // Only the dragged workout is re-timed: it starts when the one it was
        // dropped after ends. The workouts it moved past keep their times
        // rather than trading slots with it.
        const reordered = arrayMove(dayEvents, oldIndex, newIndex);
        reordered[newIndex] = stamp({
          ...reordered[newIndex],
          startMinutes: startAtIndex(state, reordered, newIndex)
        });

        return { events: [...otherEvents, ...reordered] };
      }),
      setEventTime: (id, startMinutes) => set((state) => ({
        events: state.events.map(i =>
          i.id === id ? stamp({ ...i, startMinutes: clampStartMinutes(startMinutes) }) : i
        )
      })),
      nudgeEventTime: (id, slots) => set((state) => ({
        events: state.events.map(i =>
          i.id === id
            ? stamp({
                ...i,
                startMinutes: clampStartMinutes(startMinutesOf(i) + slots * SLOT_MINUTES)
              })
            : i
        )
      })),
      setEventDuration: (id, durationMinutes) => set((state) => ({
        events: state.events.map(i =>
          i.id === id ? stamp({ ...i, durationMinutes: clampDuration(durationMinutes) }) : i
        )
      })),
      nudgeEventDuration: (id, slots) => set((state) => ({
        events: state.events.map(i => {
          if (i.id !== id) return i;
          const activity = state.activities.find(g => g.id === i.typeId);
          return stamp({
            ...i,
            durationMinutes: clampDuration(durationMinutesOf(i, activity) + slots * SLOT_MINUTES)
          });
        })
      })),

      setGoogleCalendarId: (googleCalendarId) => set({ googleCalendarId }),
      setGoogleSheetId: (googleSheetId) => set({ googleSheetId }),
      setGoogleEventIds: (eventIds) => set((state) => ({
        events: state.events.map(i =>
          eventIds[i.id] ? { ...i, googleEventId: eventIds[i.id] } : i
        )
      })),
      replaceEvents: (events) => set({ events }),

      setNote: (day, weekStart, note) => set((state) => {
        const key = noteKey(weekStart, day);
        if (!note) {
          const newNotes = { ...state.notes };
          delete newNotes[key];
          return { notes: newNotes };
        }
        return { notes: { ...state.notes, [key]: note } };
      }),
      copyWeek: (fromWeekStart, toWeekStart, parts) => set((state) => {
        const { schedule = true, activities = true } = parts ?? {};

        let events = state.events;
        const newNotes = { ...state.notes };
        if (schedule) {
          const fromEvents = state.events.filter(i => i.weekStart === fromWeekStart);
          const retainedEvents = state.events.filter(i => i.weekStart !== toWeekStart);

          const copiedEvents = fromEvents.map(i => ({
            ...i,
            id: newId('event'),
            weekStart: toWeekStart,
            // A copy is a new workout, not the same one twice, so it gets its own
            // calendar event rather than pointing at the original's.
            googleEventId: null
          }));
          events = [...retainedEvents, ...copiedEvents];

          DAYS.forEach(day => {
            const from = state.notes[noteKey(fromWeekStart, day)];
            if (from) {
              newNotes[noteKey(toWeekStart, day)] = from;
            } else {
              delete newNotes[noteKey(toWeekStart, day)];
            }
          });
        }

        // A copied week brings its bent targets with it, so the copy is a
        // faithful duplicate rather than a week snapped back to baseline.
        const weeklyTargets = { ...(state.weeklyTargets || {}) };
        if (activities) {
          state.activities.forEach(activity => {
            const from = weeklyTargets[weeklyTargetKey(fromWeekStart, activity.id)];
            const toKey = weeklyTargetKey(toWeekStart, activity.id);
            if (from === undefined) delete weeklyTargets[toKey];
            else weeklyTargets[toKey] = from;
          });
        }

        return { events, notes: newNotes, weeklyTargets };
      }),
      clearWeek: (weekStart) => set((state) => {
        const newNotes = { ...state.notes };
        DAYS.forEach(day => { delete newNotes[noteKey(weekStart, day)]; });
        const weeklyTargets = { ...(state.weeklyTargets || {}) };
        Object.keys(weeklyTargets).forEach(key => {
          if (key.startsWith(`${weekStart}:`)) delete weeklyTargets[key];
        });
        return {
          events: state.events.filter(i => i.weekStart !== weekStart),
          notes: newNotes,
          weeklyTargets
        };
      }),

      addLink: (link) => set((state) => ({ links: [...state.links, link] })),
      removeLink: (id) => set((state) => ({ links: state.links.filter(l => l.id !== id) })),

      setTempUnit: (tempUnit) => set({ tempUnit }),
      setUse24HourClock: (use24HourClock) => set({ use24HourClock }),
      setWeekStartsOn: (weekStartsOn) => set({ weekStartsOn }),
      setDefaultStartMinutes: (startMinutes) => set({
        defaultStartMinutes: clampStartMinutes(startMinutes)
      }),
      replaceAll: (state) => set(state),
      resetAll: () => set(buildInitialState()),
      clearAll: () => set({
        ...buildInitialState(),
        activities: [],
        events: [],
        links: []
      })
    }),
    {
      name: 'workout-week',
      version: 4,
      migrate: migrateStore,
      onRehydrateStorage: () => () => {
        // Run once on hydrate, this imports legacy if needed
        if (!localStorage.getItem('workout-week')) {
          const legacy = importLegacy();
          if (legacy) {
            usePlannerStore.setState(legacy);
          }
        }
      }
    }
  )
);
