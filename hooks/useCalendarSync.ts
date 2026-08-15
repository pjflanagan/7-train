'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { usePlannerStore } from '@/lib/store';
import { usePlannerHydrated } from '@/hooks/usePlannerHydrated';
import { useGoogleAccount } from '@/hooks/useAuth';
import { useCalendarSyncStore } from '@/hooks/useCalendarSyncStatus';
import { GOOGLE_INTEGRATIONS, isIntegrationConnected } from '@/lib/google';
import { PulledEvent, PulledTargets } from '@/lib/googleCalendar';
import { ScheduledEvent, Activity } from '@/lib/types';
import { buildActivitySnapshot, resolveEventActivity } from '@/lib/activitySnapshot';
import { activitiesForWeek, weekActivityKey, WeekActivities } from '@/lib/progress';
import {
  addDays,
  addWeeks,
  dateForDay,
  dayNameForDate,
  formatDateLocal,
  getWeekStartKey,
  parseDateLocal,
  WeekStartsOn,
} from '@/lib/dates';
import { clampDuration, durationMinutesOf, startMinutesOf } from '@/lib/schedule';

/**
 * Keeps the plan and the user's `Workouts` calendar in step.
 *
 * On load we pull a window of weeks and let Google win: a workout dragged to
 * another day inside Google Calendar shows up here. After that every local
 * change is mirrored back, debounced so a run of keystrokes is one write.
 *
 * Activities are deliberately not synced. An event names the activity it belongs to and
 * nothing more, so activities stay a local, per-device list.
 */

/** How much of the calendar a pull covers, in weeks either side of this one. */
const PULL_WEEKS_BACK = 8;
const PULL_WEEKS_FORWARD = 12;

/** Long enough to swallow a burst of edits, short enough to feel immediate. */
const PUSH_DEBOUNCE_MS = 1200;

/** One week's targets, on their way to Google. */
interface TargetsPayload {
  weekStart: string;
  endDate: string;
  activities: Activity[];
  googleEventId?: string;
}

/** Every week that aims at anything, in ascending order. */
function weeksWithTargets(weekActivities: WeekActivities | undefined): string[] {
  const weeks = new Set<string>();
  for (const key of Object.keys(weekActivities ?? {})) {
    weeks.add(key.slice(0, key.indexOf(':')));
  }
  return [...weeks].sort();
}

/** A week's targets as we last wrote them, so we only write real changes. */
interface SyncedTargets {
  googleEventId: string;
  signature: string;
}

/**
 * What a week aims at, as one comparable string. Order is not meaningful — the
 * same targets rearranged are the same targets — so it is sorted by id first.
 */
function targetsSignature(activities: Activity[]): string {
  return JSON.stringify([...activities].sort((a, b) => a.id.localeCompare(b.id)));
}

/** What we last wrote to Google for an event, so we only write real changes. */
interface SyncedEvent {
  /** Google's id for the event we wrote. */
  googleEventId: string;
  signature: string;
}

function eventSignature(event: ScheduledEvent, activity: Activity | undefined): string {
  return [
    event.typeId,
    event.day,
    event.weekStart,
    event.value,
    event.workoutType ?? '',
    startMinutesOf(event),
    durationMinutesOf(event, activity),
    // The activity copy is written into the event, so renaming an activity is a
    // real change to push, not just a local relabel.
    JSON.stringify(event.activitySnapshot ?? null),
    event.activityFrozen ? '1' : '',
  ].join('|');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DDTHH:mm:ss` for a date and a minute-of-day, with no zone attached. */
function wallClock(dateKey: string, minutes: number): string {
  const capped = Math.min(minutes, 24 * 60 - 1);
  return `${dateKey}T${pad(Math.floor(capped / 60))}:${pad(capped % 60)}:00`;
}

interface EventDraftPayload {
  /** Our own event id. Google's, where there is one, rides alongside. */
  eventId: string;
  typeId: string;
  title: string;
  subType: string | null;
  value: number;
  start: string;
  end: string;
  timeZone: string;
  description?: string;
  activitySnapshot?: ScheduledEvent['activitySnapshot'];
  activityFrozen?: boolean;
  weekStart: string;
}

function draftFor(
  event: ScheduledEvent,
  activity: Activity,
  weekStartsOn: WeekStartsOn,
  timeZone: string
): EventDraftPayload {
  const dateKey = formatDateLocal(dateForDay(event.weekStart, event.day, weekStartsOn));
  const start = startMinutesOf(event);
  const duration = durationMinutesOf(event, activity);

  return {
    eventId: event.id,
    typeId: event.typeId,
    title: activity.name,
    subType: event.workoutType ?? null,
    value: event.value,
    start: wallClock(dateKey, start),
    end: wallClock(dateKey, start + duration),
    timeZone,
    description:
      activity.metric === 'instance' ? undefined : `${event.value} ${activity.unit}`,
    // The event's own copy of its activity goes up with it, so a device that
    // has never seen these activities can still draw what it pulls back.
    activitySnapshot: event.activitySnapshot ?? buildActivitySnapshot(activity),
    activityFrozen: event.activityFrozen,
    weekStart: event.weekStart,
  };
}

/** A pulled event, placed back on the local week grid in the browser's zone. */
function eventFromGoogle(
  event: PulledEvent,
  weekStartsOn: WeekStartsOn
): ScheduledEvent | null {
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return null;

  // Google owns the event's length too, so a drag of its bottom edge over
  // there comes back as this event's duration.
  const end = event.end ? new Date(event.end) : null;
  const durationMinutes =
    end && !Number.isNaN(end.getTime()) && end > start
      ? clampDuration((end.getTime() - start.getTime()) / 60000)
      : undefined;

  // The week the event was filed under travels with it, so two devices that
  // disagree about which day a week starts on still agree about which week a
  // workout belongs to. It is only recomputed when the stored week does not
  // match this device's setting — the user changed it since.
  const derivedWeekStart = getWeekStartKey(start, weekStartsOn);
  const weekStart =
    event.weekStart && getWeekStartKey(parseDateLocal(event.weekStart), weekStartsOn) === event.weekStart
      ? event.weekStart
      : derivedWeekStart;

  return {
    id: event.eventId,
    typeId: event.typeId,
    day: dayNameForDate(start),
    weekStart,
    value: event.value,
    workoutType: event.workoutType,
    startMinutes: start.getHours() * 60 + start.getMinutes(),
    durationMinutes,
    googleEventId: event.googleEventId,
    // Google's stamp, not the moment we pulled it: the point of recording this
    // is to tell which side of a future merge holds the newer edit.
    updatedAt: event.updated,
    activitySnapshot: event.activitySnapshot,
    activityFrozen: event.activityFrozen,
  };
}

/**
 * Writes every local change Google does not already have, and returns once
 * Google has it.
 *
 * `synced` is both the input and the output: it says what Google already holds,
 * and is updated in place with what this push wrote. An empty map therefore
 * means "assume Google has nothing", which is exactly what the first push after
 * connecting wants — it uploads the entire plan, every week of it, rather than
 * only the weeks the pull window covers.
 */
async function pushLocalEvents(
  synced: Map<string, SyncedEvent>,
  syncedTargets: Map<string, SyncedTargets>
): Promise<void> {
  const store = usePlannerStore.getState();
  const weekStartsOn = (store.weekStartsOn ?? 1) as WeekStartsOn;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const create: EventDraftPayload[] = [];
  const update: (EventDraftPayload & { googleEventId: string })[] = [];
  const seen = new Set<string>();

  for (const event of store.events) {
    const activity = resolveEventActivity(
      event,
      activitiesForWeek(event.weekStart, store.weekActivities)
    );
    // Every event carries its own copy of its activity, so this only skips
    // data old enough to predate that — nothing the app creates now.
    if (!activity) continue;

    seen.add(event.id);
    const known = synced.get(event.id);
    const googleEventId = event.googleEventId ?? known?.googleEventId;
    const signature = eventSignature(event, activity);
    if (known && known.signature === signature && googleEventId) continue;

    const draft = draftFor(event, activity, weekStartsOn, timeZone);
    if (googleEventId) update.push({ ...draft, googleEventId });
    else create.push(draft);
  }

  const remove = [...synced.entries()]
    .filter(([eventId]) => !seen.has(eventId))
    .map(([, { googleEventId }]) => googleEventId);

  // Targets, a record per week that aims at anything.
  const targets: TargetsPayload[] = [];
  const weeksSeen = new Set<string>();

  for (const weekStart of weeksWithTargets(store.weekActivities)) {
    weeksSeen.add(weekStart);
    const activities = activitiesForWeek(weekStart, store.weekActivities);
    const signature = targetsSignature(activities);
    const known = syncedTargets.get(weekStart);
    if (known && known.signature === signature) continue;

    targets.push({
      weekStart,
      endDate: addDays(weekStart, 1),
      activities,
      googleEventId: known?.googleEventId,
    });
  }

  const removeTargets = [...syncedTargets.entries()]
    .filter(([weekStart]) => !weeksSeen.has(weekStart))
    .map(([, { googleEventId }]) => googleEventId);

  if (
    create.length === 0 &&
    update.length === 0 &&
    remove.length === 0 &&
    targets.length === 0 &&
    removeTargets.length === 0
  ) {
    return;
  }

  const response = await fetch('/api/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      calendarId: usePlannerStore.getState().googleCalendarId,
      create,
      update,
      remove,
      targets,
      removeTargets,
    }),
  });
  if (!response.ok) throw new Error((await response.json())?.error ?? 'Push failed');

  // A push with nothing to write comes back with no calendar, rather than
  // having made one just to hold the write.
  const { calendarId, eventIds, targetEventIds } = (await response.json()) as {
    calendarId: string | null;
    eventIds: Record<string, string>;
    targetEventIds: Record<string, string>;
  };

  const after = usePlannerStore.getState();
  if (calendarId) after.setGoogleCalendarId(calendarId);
  after.setGoogleEventIds(eventIds);

  // Rebuild the baseline from what we just wrote, not from the store, which may
  // have moved on while the request was in flight.
  for (const [eventId] of synced) {
    if (!seen.has(eventId)) synced.delete(eventId);
  }
  for (const draft of [...create, ...update]) {
    const googleEventId = eventIds[draft.eventId];
    const event = after.events.find((i) => i.id === draft.eventId);
    if (!googleEventId || !event) continue;
    const activity = resolveEventActivity(
      event,
      activitiesForWeek(event.weekStart, after.weekActivities)
    );
    synced.set(draft.eventId, { googleEventId, signature: eventSignature(event, activity) });
  }

  for (const [weekStart] of syncedTargets) {
    if (!weeksSeen.has(weekStart)) syncedTargets.delete(weekStart);
  }
  for (const draft of targets) {
    const googleEventId = targetEventIds?.[draft.weekStart];
    if (!googleEventId) continue;
    syncedTargets.set(draft.weekStart, {
      googleEventId,
      signature: targetsSignature(
        activitiesForWeek(draft.weekStart, after.weekActivities)
      ),
    });
  }
}

/**
 * Runs the sync. Mount this once, high in the tree — anything that only wants
 * to _watch_ sync should use `useCalendarSyncStatus` instead.
 */
export function useCalendarSync(): void {
  const { scopes, isSignedIn } = useGoogleAccount();
  // Nothing may touch Google until the persisted plan is actually in the store.
  // Before that `getState()` answers with the seeded defaults, and adopting
  // those would upload a sample week and mark the real plan as handed over.
  const isHydrated = usePlannerHydrated();
  const isConnected =
    isHydrated && isSignedIn && isIntegrationConnected(scopes, GOOGLE_INTEGRATIONS.calendar);

  const setStatus = useCalendarSyncStore((state) => state.setStatus);
  const pullNonce = useCalendarSyncStore((state) => state.resyncNonce);
  const baselineNonce = useCalendarSyncStore((state) => state.baselineNonce);

  /** Event id -> what Google already holds. Empty until the first pull lands. */
  const syncedRef = useRef(new Map<string, SyncedEvent>());
  /** Week start -> the targets record Google already holds for that week. */
  const syncedTargetsRef = useRef(new Map<string, SyncedTargets>());
  /** Pushing before the pull has landed would fight it, so it waits. */
  const isReadyRef = useRef(false);

  // Wiping the plan locally is not the same as deleting every workout: forget
  // what Google holds so the next push asks for no deletions at all.
  useEffect(() => {
    if (baselineNonce === 0) return;
    syncedRef.current = new Map();
    syncedTargetsRef.current = new Map();
  }, [baselineNonce]);

  // Hand the plan over, then let Google win.
  //
  // The upload has to happen first, and only once. Until the whole plan is in
  // Google, the local store is the only complete copy — pulling first would let
  // a window of Google's events overwrite weeks that had never been uploaded.
  // After adoption the order stops mattering, because Google holds everything.
  useEffect(() => {
    if (!isConnected) {
      isReadyRef.current = false;
      syncedRef.current.clear();
      syncedTargetsRef.current.clear();
      setStatus('off');
      return;
    }

    let cancelled = false;
    isReadyRef.current = false;

    const adoptThenPull = async () => {
      const before = usePlannerStore.getState();

      if (!before.googleAdoptedAt) {
        setStatus('syncing');
        // An empty baseline means every local event is written, whatever week
        // it falls in — the pull window does not apply to this one.
        await pushLocalEvents(syncedRef.current, syncedTargetsRef.current);
        if (cancelled) return;
        usePlannerStore.getState().setGoogleAdopted();
      }

      if (cancelled) return;
      setStatus('pulling');

      const state = usePlannerStore.getState();
      const weekStartsOn = (state.weekStartsOn ?? 1) as WeekStartsOn;
      const thisWeek = getWeekStartKey(new Date(), weekStartsOn);
      const from = parseDateLocal(addWeeks(thisWeek, -PULL_WEEKS_BACK));
      const to = parseDateLocal(addWeeks(thisWeek, PULL_WEEKS_FORWARD + 1));

      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      if (state.googleCalendarId) params.set('calendarId', state.googleCalendarId);

      const response = await fetch(`/api/calendar?${params}`);
      if (!response.ok) throw new Error((await response.json())?.error ?? 'Pull failed');
      const { calendarId, events, targets } = (await response.json()) as {
        calendarId: string;
        events: PulledEvent[];
        targets: PulledTargets[];
      };
      if (cancelled) return;

      const store = usePlannerStore.getState();
      store.setGoogleCalendarId(calendarId);

      // An event written by this app carries its own copy of its activity, so
      // it needs nothing local to be drawn. Only events written before that
      // existed fall back to the copy their local twin is holding.
      const localById = new Map(store.events.map((event) => [event.id, event]));
      const pulled: ScheduledEvent[] = [];
      const synced = new Map<string, SyncedEvent>();

      for (const pulledEvent of events) {
        const event = eventFromGoogle(pulledEvent, weekStartsOn);
        if (!event) continue;
        const local = localById.get(event.id);
        const finalEvent = event.activitySnapshot
          ? event
          : {
              ...event,
              activitySnapshot: local?.activitySnapshot,
              activityFrozen: local?.activityFrozen
            };
        pulled.push(finalEvent);
        synced.set(finalEvent.id, {
          googleEventId: pulledEvent.googleEventId,
          signature: eventSignature(
            finalEvent,
            resolveEventActivity(finalEvent, activitiesForWeek(finalEvent.weekStart, store.weekActivities))
          ),
        });
      }

      // Only the pulled window is replaced. Weeks outside it are in Google too
      // — adoption sent them — they were simply not asked for, so the local
      // copy stays as the cache of them.
      const fromKey = formatDateLocal(from);
      const toKey = formatDateLocal(to);
      const outsideWindow = store.events.filter(
        (event) => event.weekStart < fromKey || event.weekStart >= toKey
      );

      // Targets, week by week. A week the calendar holds nothing for is a week
      // aiming at nothing — inside the window that is Google's answer, not an
      // absence of one.
      const pulledTargets: WeekActivities = {};
      const syncedTargets = new Map<string, SyncedTargets>();
      for (const record of targets) {
        for (const activity of record.activities) {
          pulledTargets[weekActivityKey(record.weekStart, activity.id)] = activity;
        }
        syncedTargets.set(record.weekStart, {
          googleEventId: record.googleEventId,
          signature: targetsSignature(record.activities),
        });
      }

      const weekActivities: WeekActivities = { ...pulledTargets };
      for (const [key, activity] of Object.entries(store.weekActivities ?? {})) {
        const weekStart = key.slice(0, key.indexOf(':'));
        // Weeks the pull did not cover keep what this device holds for them.
        if (weekStart < fromKey || weekStart >= toKey) weekActivities[key] = activity;
      }

      // An event created while the pull was in flight has not been written yet.
      // It is not Google contradicting us, it is us being ahead, so it survives
      // and the next push sends it.
      const unwritten = store.events.filter(
        (event) =>
          event.weekStart >= fromKey &&
          event.weekStart < toKey &&
          !event.googleEventId &&
          !synced.has(event.id)
      );

      syncedRef.current = synced;
      syncedTargetsRef.current = syncedTargets;
      store.replaceEvents([...outsideWindow, ...pulled, ...unwritten]);
      store.replaceWeekActivities(weekActivities);
      isReadyRef.current = true;
      setStatus('synced');
    };

    adoptThenPull().catch((error) => {
      if (cancelled) return;
      console.error('Calendar sync failed', error);
      setStatus('error');
      toast.error('Could not sync your Workouts calendar');
    });

    return () => {
      cancelled = true;
    };
  }, [isConnected, pullNonce, setStatus]);

  // Push: every local change is mirrored, one debounced batch at a time. The
  // store is written immediately and this follows, so editing never waits on
  // the network — it is the cache in front of Google doing its job.
  useEffect(() => {
    if (!isConnected) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let isPushing = false;

    const push = async () => {
      if (!isReadyRef.current || isPushing) return;

      isPushing = true;
      setStatus('syncing');
      try {
        await pushLocalEvents(syncedRef.current, syncedTargetsRef.current);
        setStatus('synced');
      } catch (error) {
        console.error('Calendar push failed', error);
        setStatus('error');
        toast.error('Could not update your Workouts calendar');
      } finally {
        isPushing = false;
      }
    };

    const unsubscribe = usePlannerStore.subscribe((state, previous) => {
      // Both halves of what the calendar holds: the workouts, and what each
      // week aims at.
      if (
        state.events === previous.events &&
        state.weekActivities === previous.weekActivities
      ) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(push, PUSH_DEBOUNCE_MS);
    });

    // A pull can leave events behind that were never written, so try once on
    // connect too.
    timer = setTimeout(push, PUSH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [isConnected, pullNonce, setStatus]);
}
