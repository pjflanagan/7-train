'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { usePlannerStore } from '@/lib/store';
import { useGoogleAccount } from '@/hooks/useAuth';
import { useCalendarSyncStore } from '@/hooks/useCalendarSyncStatus';
import { GOOGLE_INTEGRATIONS, isIntegrationConnected } from '@/lib/google';
import { PulledEvent } from '@/lib/googleCalendar';
import { CalendarItem, WorkoutType } from '@/lib/types';
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
 * Goals are deliberately not synced. An event names the goal it belongs to and
 * nothing more, so goals stay a local, per-device list.
 */

/** How much of the calendar a pull covers, in weeks either side of this one. */
const PULL_WEEKS_BACK = 8;
const PULL_WEEKS_FORWARD = 12;

/** Long enough to swallow a burst of edits, short enough to feel immediate. */
const PUSH_DEBOUNCE_MS = 1200;

/** What we last wrote to Google for an item, so we only write real changes. */
interface SyncedItem {
  eventId: string;
  signature: string;
}

function itemSignature(item: CalendarItem, goal: WorkoutType | undefined): string {
  return [
    item.typeId,
    item.day,
    item.weekStart,
    item.value,
    item.workoutType ?? '',
    startMinutesOf(item),
    durationMinutesOf(item, goal),
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
  itemId: string;
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
  item: CalendarItem,
  goal: WorkoutType,
  weekStartsOn: WeekStartsOn,
  timeZone: string
): EventDraftPayload {
  const dateKey = formatDateLocal(dateForDay(item.weekStart, item.day, weekStartsOn));
  const start = startMinutesOf(item);
  const duration = durationMinutesOf(item, goal);

  return {
    itemId: item.id,
    typeId: item.typeId,
    title: goal.name,
    subType: item.workoutType ?? null,
    value: item.value,
    start: wallClock(dateKey, start),
    end: wallClock(dateKey, start + duration),
    timeZone,
    description:
      goal.metric === 'times' ? undefined : `${item.value} ${goal.unit}`,
  };
}

/** A pulled event, placed back on the local week grid in the browser's zone. */
function itemFromEvent(
  event: PulledEvent,
  weekStartsOn: WeekStartsOn
): CalendarItem | null {
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return null;

  // Google owns the event's length too, so a drag of its bottom edge over
  // there comes back as this item's duration.
  const end = event.end ? new Date(event.end) : null;
  const durationMinutes =
    end && !Number.isNaN(end.getTime()) && end > start
      ? clampDuration((end.getTime() - start.getTime()) / 60000)
      : undefined;

  return {
    id: event.itemId,
    typeId: event.typeId,
    day: dayNameForDate(start),
    weekStart: getWeekStartKey(start, weekStartsOn),
    value: event.value,
    workoutType: event.workoutType,
    startMinutes: start.getHours() * 60 + start.getMinutes(),
    durationMinutes,
    googleEventId: event.eventId,
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

  /** Item id -> what Google already holds. Empty until the first pull lands. */
  const syncedRef = useRef(new Map<string, SyncedItem>());
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

        const goalIds = new Set(store.goals.map((goal) => goal.id));
        const pulled: CalendarItem[] = [];
        const synced = new Map<string, SyncedItem>();

        for (const event of events) {
          const item = itemFromEvent(event, weekStartsOn);
          // An event for a goal this device does not have is left in Google
          // untouched; goals are local, so we simply cannot draw it.
          if (!item || !goalIds.has(item.typeId)) continue;
          pulled.push(item);
          synced.set(item.id, {
            eventId: event.eventId,
            signature: itemSignature(item, store.goals.find((g) => g.id === item.typeId)),
          });
        }

        // Only the pulled window is replaced. Weeks outside it were never sent
        // to Google, so an empty response there means "not asked", not "empty".
        const fromKey = formatDateLocal(from);
        const toKey = formatDateLocal(to);
        const outsideWindow = store.items.filter(
          (item) => item.weekStart < fromKey || item.weekStart >= toKey
        );

        // A local item inside the window with no event yet is a plan made
        // offline; it survives the pull and gets pushed up next.
        const unsynced = store.items.filter(
          (item) =>
            item.weekStart >= fromKey &&
            item.weekStart < toKey &&
            !item.googleEventId &&
            !synced.has(item.id)
        );

        syncedRef.current = synced;
        store.replaceCalendarItems([...outsideWindow, ...pulled, ...unsynced]);
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

      for (const item of store.items) {
        const goal = store.goals.find((g) => g.id === item.typeId);
        if (!goal) continue;

        seen.add(item.id);
        const known = synced.get(item.id);
        const eventId = item.googleEventId ?? known?.eventId;
        const signature = itemSignature(item, goal);
        if (known && known.signature === signature && eventId) continue;

        const draft = draftFor(item, goal, weekStartsOn, timeZone);
        if (eventId) update.push({ ...draft, eventId });
        else create.push(draft);
      }

      const remove = [...synced.entries()]
        .filter(([itemId]) => !seen.has(itemId))
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
        for (const [itemId] of synced) {
          if (!seen.has(itemId)) synced.delete(itemId);
        }
        for (const draft of [...create, ...update]) {
          const eventId = eventIds[draft.itemId];
          const item = after.items.find((i) => i.id === draft.itemId);
          const goal = after.goals.find((g) => g.id === draft.typeId);
          if (!eventId || !item) continue;
          synced.set(draft.itemId, { eventId, signature: itemSignature(item, goal) });
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
      if (state.items === previous.items) return;
      clearTimeout(timer);
      timer = setTimeout(push, PUSH_DEBOUNCE_MS);
    });

    // A pull can leave local-only items behind, so try once on connect too.
    timer = setTimeout(push, PUSH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [isConnected, pullNonce, setStatus]);
}
