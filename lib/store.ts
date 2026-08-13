import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlannerState, Activity, ScheduledEvent, HelpfulLink } from './types';
import { DEFAULT_ACTIVITIES, getDefaultEvents, DEFAULT_LINKS, DAYS } from './constants';
import { importLegacy, migrateStore } from './migrate';
import { getWeekStartKey, WeekStartsOn } from './dates';
import { weekActivityKey, activitiesForWeek } from './progress';
import { buildActivitySnapshot } from './activitySnapshot';
import {
  byStartTime,
  clampDuration,
  clampStartMinutes,
  DEFAULT_START_MINUTES,
  durationMinutesOf,
  startMinutesOf
} from './schedule';
import { arrayMove } from '@dnd-kit/sortable';

type DayName = typeof DAYS[number];

export const noteKey = (weekStart: string, day: DayName) => `${weekStart}-${day}`;

type PlannerStore = PlannerState & {
  /**
   * "My activities" is the template a week can be built from, and nothing more.
   * These four touch it alone: no week, and nothing already scheduled, moves
   * because the template did.
   */
  addActivity: (activity: Activity) => void;
  updateActivity: (id: string, activity: Partial<Activity>) => void;
  deleteActivity: (id: string) => void;
  reorderActivities: (oldIndex: number, newIndex: number) => void;

  /**
   * Put an activity on one week. Week-only by design: adding a week's activity
   * never writes it back to the template.
   */
  addWeekActivity: (weekStart: string, activity: Activity) => void;
  /** Edit one week's copy of an activity. The template is untouched. */
  updateWeekActivity: (weekStart: string, id: string, updates: Partial<Activity>) => void;
  /**
   * Take an activity off one week. Anything already scheduled against it stays
   * where it is, holding on to what the activity was.
   */
  removeWeekActivity: (weekStart: string, id: string) => void;
  /** How much of an activity one week aims at. */
  setActivityTarget: (id: string, target: number, weekStart: string) => void;

  addEvent: (event: Omit<ScheduledEvent, 'id'>) => void;
  updateEventValue: (id: string, value: number) => void;
  setEventSubType: (id: string, subType: string | null) => void;
  removeEvent: (id: string) => void;
  moveEvent: (id: string, targetDay: DayName, targetWeekStart: string, newIndex?: number) => void;
  reorderDay: (day: DayName, weekStart: string, oldIndex: number, newIndex: number) => void;
  /** Move an event through the day. Minutes from local midnight, snapped to 15. */
  setEventTime: (id: string, startMinutes: number) => void;
  /** Set how long an event runs. Minutes, snapped to 15. */
  setEventDuration: (id: string, durationMinutes: number) => void;

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
   * Pull another week into this one. The schedule, day notes, and the activity
   * targets are copied independently, so a week can inherit any subset of
   * them. Whichever part is copied overwrites what was there.
   * A null `fromWeekStart` resets targets to each activity's baseline instead
   * of copying another week's bent values; schedule and notes are skipped in
   * that case.
   */
  copyWeek: (
    fromWeekStart: string | null,
    toWeekStart: string,
    parts?: { schedule?: boolean; notes?: boolean; activities?: boolean }
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
    // A week holds only what has been copied into it, so the seeded week is
    // filled from the template outright — otherwise a first run shows a plan
    // with nothing to hit.
    weekActivities: Object.fromEntries(
      DEFAULT_ACTIVITIES.map(activity => [
        weekActivityKey(weekStart, activity.id),
        { ...activity }
      ])
    ),
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

      // Template only. A week that was built from this activity keeps the copy
      // it was given, so editing or deleting here never reaches a plan.
      addActivity: (activity) => set((state) => ({ activities: [...state.activities, activity] })),
      updateActivity: (id, updates) => set((state) => ({
        activities: state.activities.map(g => g.id === id ? { ...g, ...updates } : g)
      })),
      deleteActivity: (id) => set((state) => ({
        activities: state.activities.filter(g => g.id !== id)
      })),
      reorderActivities: (oldIndex, newIndex) => set((state) => ({
        activities: arrayMove(state.activities, oldIndex, newIndex)
      })),

      addWeekActivity: (weekStart, activity) => set((state) => ({
        weekActivities: {
          ...(state.weekActivities || {}),
          [weekActivityKey(weekStart, activity.id)]: activity
        }
      })),
      updateWeekActivity: (weekStart, id, updates) => set((state) => {
        const key = weekActivityKey(weekStart, id);
        const current = state.weekActivities?.[key];
        if (!current) return {};

        // How an event's `value` is read — its metric and its unit — is the one
        // thing an edit cannot reach backwards and change. Re-measuring
        // swimming from miles to minutes describes swimming from now on; the
        // sessions already on the week keep the meaning they were entered with,
        // so they take a snapshot on the way past. An event that already holds
        // one keeps it: the first freeze is the truthful one.
        const remeasured =
          ('metric' in updates && updates.metric !== current.metric) ||
          ('unit' in updates && updates.unit !== current.unit);

        return {
          weekActivities: { ...state.weekActivities, [key]: { ...current, ...updates } },
          events: remeasured
            ? state.events.map(i =>
                i.typeId === id && i.weekStart === weekStart && !i.activitySnapshot
                  ? { ...i, activitySnapshot: buildActivitySnapshot(current) }
                  : i
              )
            : state.events
        };
      }),
      removeWeekActivity: (weekStart, id) => set((state) => {
        const key = weekActivityKey(weekStart, id);
        const removed = state.weekActivities?.[key];
        const weekActivities = { ...(state.weekActivities || {}) };
        delete weekActivities[key];
        // The week stops aiming at it, but a session already on the calendar
        // stays real — it snapshots the icon, name, and value formatting it
        // needs to keep rendering on its own.
        return {
          weekActivities,
          events: removed
            ? state.events.map(i =>
                i.typeId === id && i.weekStart === weekStart && !i.activitySnapshot
                  ? { ...i, activitySnapshot: buildActivitySnapshot(removed) }
                  : i
              )
            : state.events
        };
      }),
      setActivityTarget: (id, target, weekStart) => set((state) => {
        const key = weekActivityKey(weekStart, id);
        const current = state.weekActivities?.[key];
        if (!current) return {};
        return { weekActivities: { ...state.weekActivities, [key]: { ...current, target } } };
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
      setEventDuration: (id, durationMinutes) => set((state) => ({
        events: state.events.map(i =>
          i.id === id ? stamp({ ...i, durationMinutes: clampDuration(durationMinutes) }) : i
        )
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
        const { schedule = true, notes = true, activities = true } = parts ?? {};

        let events = state.events;
        if (schedule && fromWeekStart !== null) {
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
        }

        const newNotes = { ...state.notes };
        if (notes && fromWeekStart !== null) {
          DAYS.forEach(day => {
            const from = state.notes[noteKey(fromWeekStart, day)];
            if (from) {
              newNotes[noteKey(toWeekStart, day)] = from;
            } else {
              delete newNotes[noteKey(toWeekStart, day)];
            }
          });
        }

        // Filling a week means copying activities into it — from another week,
        // or from the template when there is no source week, which is what
        // "default activities" means. Either way the week gets its own copies:
        // editing them afterwards moves nothing but this week.
        let weekActivities = state.weekActivities;
        if (activities) {
          const kept = Object.fromEntries(
            Object.entries(state.weekActivities || {}).filter(
              ([key]) => !key.startsWith(`${toWeekStart}:`)
            )
          );
          const source =
            fromWeekStart === null
              ? state.activities
              : activitiesForWeek(fromWeekStart, state.weekActivities);
          source.forEach(activity => {
            kept[weekActivityKey(toWeekStart, activity.id)] = { ...activity };
          });
          weekActivities = kept;
        }

        return { events, notes: newNotes, weekActivities };
      }),
      clearWeek: (weekStart) => set((state) => {
        const newNotes = { ...state.notes };
        DAYS.forEach(day => { delete newNotes[noteKey(weekStart, day)]; });
        const weekActivities = { ...(state.weekActivities || {}) };
        Object.keys(weekActivities).forEach(key => {
          if (key.startsWith(`${weekStart}:`)) delete weekActivities[key];
        });
        return {
          events: state.events.filter(i => i.weekStart !== weekStart),
          notes: newNotes,
          weekActivities
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
        // The seeded state fills the current week from the template. With no
        // template left to have come from, those targets are the one thing a
        // blank slate must not keep.
        weekActivities: {},
        links: []
      })
    }),
    {
      name: 'workout-week',
      version: 8,
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
