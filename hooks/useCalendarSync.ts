'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { usePlannerStore } from '@/lib/store';
import { useGoogleAccount } from '@/hooks/useAuth';
import { useCalendarSyncStore } from '@/hooks/useCalendarSyncStatus';
import { GOOGLE_INTEGRATIONS, isIntegrationConnected } from '@/lib/google';
import { PulledEvent } from '@/lib/googleCalendar';
import { ScheduledEvent, Activity } from '@/lib/types';
import { resolveEventActivity } from '@/lib/activitySnapshot';
import { activitiesForWeek } from '@/lib/progress';
import {
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

/** What we last wrote to Google for an event, so we only write real changes. */
interface SyncedEvent {
  eventId: string;
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
  eventId: string;
  typeId: string;
  title: string;
  subType: string | null;
  value: number;
  start: string;
  end: string;
  timeZone: string;
  description?: string;
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

  return {
    id: event.eventId,
    typeId: event.typeId,
    day: dayNameForDate(start),
    weekStart: getWeekStartKey(start, weekStartsOn),
    value: event.value,
    workoutType: event.workoutType,
    startMinutes: start.getHours() * 60 + start.getMinutes(),
    durationMinutes,
    googleEventId: event.eventId,
    // Google's stamp, not the moment we pulled it: the point of recording this
    // is to tell which side of a future merge holds the newer edit.
    updatedAt: event.updated,
  };
}

/**
 * Runs the sync. Mount this once, high in the tree — anything that only wants
 * to _watch_ sync should use `useCalendarSyncStatus` instead.
 */
export function useCalendarSync(): void {
  const { scopes, isSignedIn } = useGoogleAccount();
  const isConnected = isSignedIn && isIntegrationConnected(scopes, GOOGLE_INTEGRATIONS.calendar);

  const setStatus = useCalendarSyncStore((state) => state.setStatus);
  const pullNonce = useCalendarSyncStore((state) => state.resyncNonce);

  /** Event id -> what Google already holds. Empty until the first pull lands. */
  const syncedRef = useRef(new Map<string, SyncedEvent>());
  /** Pushing before the pull has landed would fight it, so it waits. */
  const isReadyRef = useRef(false);

  // Pull: Google wins on load.
  useEffect(() => {
    if (!isConnected) {
      isReadyRef.current = false;
      syncedRef.current.clear();
      setStatus('off');
      return;
    }

    let cancelled = false;
    isReadyRef.current = false;
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

    fetch(`/api/calendar?${params}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json())?.error ?? 'Pull failed');
        return response.json() as Promise<{ calendarId: string; events: PulledEvent[] }>;
      })
      .then(({ calendarId, events }) => {
        if (cancelled) return;

        const store = usePlannerStore.getState();
        store.setGoogleCalendarId(calendarId);

        // The wire does not carry the activity yet (see
        // `_todo/google-calendar-as-storage.md`), so a pulled event takes back
        // the copy its local twin was holding. Failing that it has to be
        // recognizable in the week it lands in.
        const knownInWeek = (event: ScheduledEvent) =>
          activitiesForWeek(event.weekStart, store.weekActivities).some(
            (activity) => activity.id === event.typeId
          );
        const localById = new Map(store.events.map((event) => [event.id, event]));
        const pulled: ScheduledEvent[] = [];
        const synced = new Map<string, SyncedEvent>();

        for (const pulledEvent of events) {
          const event = eventFromGoogle(pulledEvent, weekStartsOn);
          if (!event) continue;
          const local = localById.get(event.id);
          // An event for an activity this device has never had, and holds no
          // copy of, is left in Google untouched; we simply cannot draw it.
          if (!knownInWeek(event) && !local?.activitySnapshot) continue;
          const finalEvent = local?.activitySnapshot
            ? {
                ...event,
                activitySnapshot: local.activitySnapshot,
                activityFrozen: local.activityFrozen
              }
            : event;
          pulled.push(finalEvent);
          synced.set(finalEvent.id, {
            eventId: pulledEvent.eventId,
            signature: eventSignature(
              finalEvent,
              resolveEventActivity(finalEvent, activitiesForWeek(finalEvent.weekStart, store.weekActivities))
            ),
          });
        }

        // Only the pulled window is replaced. Weeks outside it were never sent
        // to Google, so an empty response there means "not asked", not "empty".
        const fromKey = formatDateLocal(from);
        const toKey = formatDateLocal(to);
        const outsideWindow = store.events.filter(
          (event) => event.weekStart < fromKey || event.weekStart >= toKey
        );

        // A local event inside the window with no event yet is a plan made
        // offline; it survives the pull and gets pushed up next.
        const unsynced = store.events.filter(
          (event) =>
            event.weekStart >= fromKey &&
            event.weekStart < toKey &&
            !event.googleEventId &&
            !synced.has(event.id)
        );

        syncedRef.current = synced;
        store.replaceEvents([...outsideWindow, ...pulled, ...unsynced]);
        isReadyRef.current = true;
        setStatus('synced');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Calendar pull failed', error);
        setStatus('error');
        toast.error('Could not read your Workouts calendar');
      });

    return () => {
      cancelled = true;
    };
  }, [isConnected, pullNonce, setStatus]);

  // Push: every local change is mirrored, one debounced batch at a time.
  useEffect(() => {
    if (!isConnected) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let isPushing = false;

    const push = async () => {
      if (!isReadyRef.current || isPushing) return;

      const store = usePlannerStore.getState();
      const weekStartsOn = (store.weekStartsOn ?? 1) as WeekStartsOn;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const synced = syncedRef.current;

      const create: EventDraftPayload[] = [];
      const update: (EventDraftPayload & { eventId: string })[] = [];
      const seen = new Set<string>();

      for (const event of store.events) {
        const activity = resolveEventActivity(
          event,
          activitiesForWeek(event.weekStart, store.weekActivities)
        );
        if (!activity) continue;

        seen.add(event.id);
        const known = synced.get(event.id);
        const eventId = event.googleEventId ?? known?.eventId;
        const signature = eventSignature(event, activity);
        if (known && known.signature === signature && eventId) continue;

        const draft = draftFor(event, activity, weekStartsOn, timeZone);
        if (eventId) update.push({ ...draft, eventId });
        else create.push(draft);
      }

      const remove = [...synced.entries()]
        .filter(([eventId]) => !seen.has(eventId))
        .map(([, { eventId }]) => eventId);

      if (create.length === 0 && update.length === 0 && remove.length === 0) {
        setStatus('synced');
        return;
      }

      isPushing = true;
      setStatus('syncing');
      try {
        const response = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarId: usePlannerStore.getState().googleCalendarId,
            create,
            update,
            remove,
          }),
        });
        if (!response.ok) throw new Error((await response.json())?.error ?? 'Push failed');

        const { calendarId, eventIds } = (await response.json()) as {
          calendarId: string;
          eventIds: Record<string, string>;
        };

        const after = usePlannerStore.getState();
        after.setGoogleCalendarId(calendarId);
        after.setGoogleEventIds(eventIds);

        // Rebuild the baseline from what we just wrote, not from the store,
        // which may have moved on while the request was in flight.
        for (const [eventId] of synced) {
          if (!seen.has(eventId)) synced.delete(eventId);
        }
        for (const draft of [...create, ...update]) {
          const eventId = eventIds[draft.eventId];
          const event = after.events.find((i) => i.id === draft.eventId);
          if (!eventId || !event) continue;
          const activity = resolveEventActivity(
            event,
            activitiesForWeek(event.weekStart, after.weekActivities)
          );
          synced.set(draft.eventId, { eventId, signature: eventSignature(event, activity) });
        }

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
      if (state.events === previous.events) return;
      clearTimeout(timer);
      timer = setTimeout(push, PUSH_DEBOUNCE_MS);
    });

    // A pull can leave local-only events behind, so try once on connect too.
    timer = setTimeout(push, PUSH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [isConnected, pullNonce, setStatus]);
}
