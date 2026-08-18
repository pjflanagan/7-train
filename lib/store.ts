import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlannerState, Activity, ActivitySnapshot, ScheduledEvent, HelpfulLink } from './types';
import { DEFAULT_ACTIVITIES, getDefaultEvents, DEFAULT_LINKS } from './seed';
import { DAYS } from './constants';
import { importLegacy, migrateStore } from './migrate';
import { getWeekStartKey, WeekStartsOn } from './dates';
import { weekActivityKey, activitiesForWeek, WeekActivities } from './progress';
import { buildActivitySnapshot, resolveEventActivity } from './activitySnapshot';
import {
  clampDuration,
  clampStartMinutes,
  DEFAULT_START_MINUTES,
  durationMinutesOf,
  startMinutesOf
} from './schedule';
import { arrayMove } from '@dnd-kit/sortable';
import type { StravaEventUpdate } from './strava';
import type { UserSettings } from './userSettings';

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
  /**
   * Put an event on another day. It keeps the time it already had: where a
   * workout sits within a day follows from when it starts, and when it starts
   * is Google Calendar's to say.
   */
  moveEvent: (id: string, targetDay: DayName, targetWeekStart: string) => void;
  /**
   * Set how long an event runs. Minutes, snapped to 15.
   *
   * The only hand edit left to an event's timing: when a workout starts is
   * Google Calendar's to change, and comes back here on the next pull.
   */
  setEventDuration: (id: string, durationMinutes: number) => void;

  /**
   * Write what Strava says actually happened into the plan: planned workouts
   * corrected to their real numbers, and recordings nothing was planned for
   * added as new events on the day they happened.
   *
   * One action rather than a loop of `updateEventValue`/`addEvent` calls,
   * because calendar sync watches `events` — a sync of twelve recordings should
   * be one push, not twelve.
   */
  applyStrava: (result: {
    updates: StravaEventUpdate[];
    creations: Omit<ScheduledEvent, 'id'>[];
  }) => void;

  /**
   * Take what the server holds for this user: their settings, and the
   * activities "My activities" is built from.
   *
   * One action, in one write, because everything watching the store — calendar
   * sync above all — should see a settled user rather than a settings change
   * followed a frame later by an activity change.
   */
  applyRemoteUser: (remote: {
    settings: UserSettings;
    activities?: Activity[];
  }) => void;

  setGoogleCalendarId: (calendarId: string | null) => void;
  /** What Google currently calls that calendar. Refreshed by every pull. */
  setGoogleCalendarName: (calendarName: string | null) => void;
  /** Record that the whole plan now lives in Google Calendar. */
  setGoogleAdopted: () => void;
  setGoogleSheetId: (sheetId: string | null) => void;
  /** Record which Google event now mirrors each event, keyed by event id. */
  setGoogleEventIds: (eventIds: Record<string, string>) => void;
  /**
   * Swap the whole schedule for what Google Calendar holds. Activities, notes and
   * settings stay put: the calendar owns events only.
   */
  replaceEvents: (events: ScheduledEvent[]) => void;
  /**
   * Swap every week's targets for what Google Calendar holds. Same contract as
   * `replaceEvents`: the caller has already decided which weeks the calendar
   * spoke for and which it was not asked about.
   */
  replaceWeekActivities: (weekActivities: WeekActivities) => void;

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
    googleCalendarName: null,
    googleAdoptedAt: null,
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

  const latestEnd = dayEvents.reduce(
    (end, event) => Math.max(end, startMinutesOf(event) + lengthOf(state, event)),
    defaultStart
  );

  return clampStartMinutes(latestEnd);
}

/**
 * How long a workout runs. Read off the event's own copy of its activity, so a
 * week with no targets still stacks its workouts at sensible lengths.
 */
function lengthOf(state: PlannerState, event: ScheduledEvent): number {
  const activity = resolveEventActivity(
    event,
    activitiesForWeek(event.weekStart, state.weekActivities)
  );
  return durationMinutesOf(event, activity);
}

/**
 * The copy of an activity a new event on `weekStart` should carry — the week's
 * own version of it, else the template in "My activities". A week is filled from
 * the template, so the two normally agree; the fallback covers an event added to
 * a week that has no target for it.
 */
function snapshotFor(
  state: PlannerState,
  weekStart: string,
  typeId: string
): ActivitySnapshot | undefined {
  const activity =
    state.weekActivities?.[weekActivityKey(weekStart, typeId)] ??
    state.activities.find(a => a.id === typeId);
  return activity ? buildActivitySnapshot(activity) : undefined;
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
        // so their snapshot freezes on the way past, holding the activity as it
        // was. An event already frozen keeps what it has: the first freeze is
        // the truthful one.
        //
        // Every other edit — a rename, a colour, a pace — does describe the
        // sessions already on the week, so their snapshots follow it.
        const updated = { ...current, ...updates };
        const remeasured =
          ('metric' in updates && updates.metric !== current.metric) ||
          ('unit' in updates && updates.unit !== current.unit);
        const frozenSnapshot = buildActivitySnapshot(current);
        const trackingSnapshot = buildActivitySnapshot(updated);

        return {
          weekActivities: { ...state.weekActivities, [key]: updated },
          events: state.events.map(i => {
            if (i.typeId !== id || i.weekStart !== weekStart || i.activityFrozen) return i;
            return remeasured
              ? { ...i, activitySnapshot: frozenSnapshot, activityFrozen: true }
              : { ...i, activitySnapshot: trackingSnapshot };
          })
        };
      }),
      removeWeekActivity: (weekStart, id) => set((state) => {
        const key = weekActivityKey(weekStart, id);
        const removed = state.weekActivities?.[key];
        const weekActivities = { ...(state.weekActivities || {}) };
        delete weekActivities[key];
        // The week stops aiming at it, but a session already on the calendar
        // stays real — its snapshot freezes as the activity last stood, so
        // re-adding a differently shaped activity under the same id later does
        // not reach back and change what was already scheduled.
        return {
          weekActivities,
          events: removed
            ? state.events.map(i =>
                i.typeId === id && i.weekStart === weekStart && !i.activityFrozen
                  ? {
                      ...i,
                      activitySnapshot: buildActivitySnapshot(removed),
                      activityFrozen: true
                    }
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
            startMinutes: event.startMinutes ?? nextFreeSlot(state, event.day, event.weekStart),
            // An event describes itself from the moment it exists, so it takes
            // its copy of the activity here rather than leaning on the week.
            activitySnapshot: event.activitySnapshot ?? snapshotFor(state, event.weekStart, event.typeId)
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
      // Only which day it is on changes. Dropping a workout onto a day used to
      // re-time it from whatever it landed beside, which was the last way left
      // to set a start time by hand — a day's order is read off its start
      // times, and those come from the calendar.
      moveEvent: (id, targetDay, targetWeekStart) => set((state) => ({
        events: state.events.map(i =>
          i.id === id ? stamp({ ...i, day: targetDay, weekStart: targetWeekStart }) : i
        )
      })),
      setEventDuration: (id, durationMinutes) => set((state) => ({
        events: state.events.map(i =>
          i.id === id ? stamp({ ...i, durationMinutes: clampDuration(durationMinutes) }) : i
        )
      })),

      applyStrava: ({ updates, creations }) => set((state) => {
        if (updates.length === 0 && creations.length === 0) return {};

        const byEventId = new Map(updates.map((update) => [update.eventId, update]));

        const corrected = state.events.map((event) => {
          const update = byEventId.get(event.id);
          // An event that picked up a recording since the reconciliation was
          // worked out is finished, and is left exactly as it is.
          if (!update || event.stravaActivityId != null) return event;
          return stamp({
            ...event,
            value: update.value,
            startMinutes: update.startMinutes,
            durationMinutes: update.durationMinutes,
            stravaActivityId: update.stravaActivityId,
          });
        });

        const added = creations.map((event) => stamp({
          ...event,
          id: newId('event'),
          activitySnapshot:
            event.activitySnapshot ?? snapshotFor(state, event.weekStart, event.typeId)
        }));

        return { events: [...corrected, ...added] };
      }),

      applyRemoteUser: ({ settings, activities }) => set(() => ({
        googleCalendarId: settings.googleCalendarId,
        googleAdoptedAt: settings.googleAdoptedAt,
        googleSheetId: settings.googleSheetId,
        weekStartsOn: settings.weekStartsOn as WeekStartsOn,
        tempUnit: settings.tempUnit,
        use24HourClock: settings.use24HourClock,
        defaultStartMinutes: settings.defaultStartMinutes,
        // Only when the server actually has some. An account that has never
        // synced must not blank out the activities this browser is holding —
        // that is the whole reason the pull reports `isNew`.
        ...(activities && activities.length > 0 ? { activities } : {}),
      })),

      setGoogleCalendarId: (googleCalendarId) => set({ googleCalendarId }),
      setGoogleCalendarName: (googleCalendarName) => set({ googleCalendarName }),
      setGoogleAdopted: () => set({ googleAdoptedAt: new Date().toISOString() }),
      setGoogleSheetId: (googleSheetId) => set({ googleSheetId }),
      setGoogleEventIds: (eventIds) => set((state) => ({
        events: state.events.map(i =>
          eventIds[i.id] ? { ...i, googleEventId: eventIds[i.id] } : i
        )
      })),
      replaceEvents: (events) => set({ events }),
      replaceWeekActivities: (weekActivities) => set({ weekActivities }),

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
      // Which Google calendar and spreadsheet we own is a connection setting,
      // not part of the plan — dropping it makes the next sync create a second
      // `Workouts` calendar rather than reusing the one already there, and with
      // no way to search for it (see `ensureWorkoutsCalendar`) that duplicate is
      // permanent. Both wipes keep it.
      resetAll: () => set((state) => ({
        ...buildInitialState(),
        googleCalendarId: state.googleCalendarId,
        googleAdoptedAt: state.googleAdoptedAt,
        googleSheetId: state.googleSheetId
      })),
      clearAll: () => set((state) => ({
        ...buildInitialState(),
        googleCalendarId: state.googleCalendarId,
        googleAdoptedAt: state.googleAdoptedAt,
        googleSheetId: state.googleSheetId,
        activities: [],
        events: [],
        // The seeded state fills the current week from the template. With no
        // template left to have come from, those targets are the one thing a
        // blank slate must not keep.
        weekActivities: {},
        links: []
      }))
    }),
    {
      name: 'workout-week',
      version: 10,
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
