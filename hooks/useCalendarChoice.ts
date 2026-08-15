'use client';

import { useCallback, useState } from 'react';
import { usePlannerStore } from '@/lib/store';
import { useCalendarSyncStore } from '@/hooks/useCalendarSyncStatus';

/**
 * Choosing which calendar the workouts live in.
 *
 * Two answers, and they mean opposite things about who is right:
 *
 * - **Adopt an existing calendar** — that calendar is the plan. Whatever this
 *   device is holding is set aside, because on a browser that has just signed
 *   in that is the seeded sample week, and pushing it would litter a real
 *   calendar with sample workouts.
 * - **Create a new calendar** — this device is the plan, and it gets uploaded
 *   into the empty calendar we just made.
 */
export function useCalendarChoice() {
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adoptExisting = useCallback(async (rawId: string): Promise<boolean> => {
    const calendarId = rawId.trim();
    if (!calendarId) {
      setError('Paste a calendar ID first.');
      return false;
    }

    setIsWorking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/calendar/verify?calendarId=${encodeURIComponent(calendarId)}`
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? 'Could not check that calendar');
      if (!body.found) {
        setError('No calendar with that ID, or it is not one this app created.');
        return false;
      }

      const store = usePlannerStore.getState();
      const sync = useCalendarSyncStore.getState();

      // Nothing we hold has been written to this calendar, so there is no
      // baseline and nothing of ours to delete over there.
      sync.forgetBaseline();
      store.replaceEvents([]);
      store.replaceWeekActivities({});
      store.setGoogleCalendarId(body.calendarId);
      // Already handed over — by someone. Adopting means taking their word for
      // it, not uploading this device's copy on top.
      store.setGoogleAdopted();
      sync.resync();
      return true;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not check that calendar');
      return false;
    } finally {
      setIsWorking(false);
    }
  }, []);

  const createNew = useCallback(async (): Promise<boolean> => {
    setIsWorking(true);
    setError(null);
    try {
      const response = await fetch('/api/calendar/create', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? 'Could not create a calendar');

      const store = usePlannerStore.getState();
      // A new calendar is empty, so this device's plan is the one there is —
      // leaving `googleAdoptedAt` unset is what makes sync upload all of it.
      store.setGoogleCalendarId(body.calendarId);
      useCalendarSyncStore.getState().resync();
      return true;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not create a calendar');
      return false;
    } finally {
      setIsWorking(false);
    }
  }, []);

  return { adoptExisting, createNew, isWorking, error, setError };
}
