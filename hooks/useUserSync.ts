'use client';

import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { toast } from 'sonner';
import { usePlannerStore } from '@/lib/store';
import { usePlannerHydrated } from '@/hooks/usePlannerHydrated';
import { useGoogleAccount } from '@/hooks/useAuth';
import {
  UserState,
  UserStateSchema,
  activitiesSignature,
  mergeOnFirstPull,
  settingsFromState,
  settingsSignature,
} from '@/lib/userSettings';

/**
 * The user's settings and activities, kept on the server.
 *
 * What this buys, above everything else: a second device finds the *same*
 * `Workouts` calendar instead of making its own. `googleCalendarId` is the only
 * thread back to that calendar and it used to live in one browser's
 * `localStorage`, so clearing site data or opening a private window forked the
 * plan across two calendars, permanently. Held against the Google account, it
 * survives all of that.
 *
 * Events are not here. Google Calendar stores those; see
 * `_todo/google-calendar-as-storage.md` for the division of labour.
 *
 * Local-first is unchanged. Signed out, or on a deployment with no database,
 * this does nothing at all and the app behaves exactly as it did before.
 */

export type UserSyncStatus =
  /** Signed out, or the server has no database. Nothing will happen. */
  | 'off'
  | 'pulling'
  | 'saving'
  | 'synced'
  | 'error';

interface UserSyncState {
  status: UserSyncStatus;
  /**
   * Whether the first pull has finished. Anything that would otherwise act on a
   * setting the server is about to supply — making a `Workouts` calendar above
   * all — waits for this rather than jumping in.
   */
  hasPulled: boolean;
  setStatus: (status: UserSyncStatus) => void;
  setHasPulled: (hasPulled: boolean) => void;
}

export const useUserSyncStore = create<UserSyncState>((set) => ({
  status: 'off',
  hasPulled: false,
  setStatus: (status) => set({ status }),
  setHasPulled: (hasPulled) => set({ hasPulled }),
}));

/**
 * True once the server has been asked about this user — or once it is settled
 * that it never will be, signed out or with no database configured.
 *
 * The distinction matters for exactly one thing: `useEnsureCalendar` must not
 * create a second `Workouts` calendar a beat before being told about the first.
 */
export function useUserSettled(): boolean {
  const status = useUserSyncStore((state) => state.status);
  const hasPulled = useUserSyncStore((state) => state.hasPulled);
  return status === 'off' || hasPulled;
}

/** How long a settings change sits before it is sent, matching calendar sync. */
const PUSH_DEBOUNCE_MS = 2000;

async function pushUser(body: {
  settings?: unknown;
  activities?: unknown;
}): Promise<void> {
  const response = await fetch('/api/user', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error((await response.json().catch(() => null))?.error ?? 'Save failed');
  }
}

/**
 * Runs the sync. Mount once, high in the tree, alongside `useCalendarSync`.
 */
export function useUserSync(): void {
  const { isSignedIn } = useGoogleAccount();
  // Until the persisted plan is really in the store, `getState()` answers with
  // the seeded defaults — and uploading those as someone's activities would
  // overwrite the real ones on every other device.
  const isHydrated = usePlannerHydrated();

  const setStatus = useUserSyncStore((state) => state.setStatus);
  const setHasPulled = useUserSyncStore((state) => state.setHasPulled);

  /** What the server already holds, so an unchanged push is never sent. */
  const syncedRef = useRef<{ settings: string; activities: string } | null>(null);
  /** Pushing before the pull lands would fight it, so it waits. */
  const isReadyRef = useRef(false);

  useEffect(() => {
    if (!isHydrated || !isSignedIn) {
      isReadyRef.current = false;
      syncedRef.current = null;
      setStatus('off');
      setHasPulled(false);
      return;
    }

    let cancelled = false;

    const pull = async () => {
      setStatus('pulling');

      const response = await fetch('/api/user');

      // 501 is a deployment with no database, 401 a session that expired
      // mid-flight. Neither is an error worth showing: the plan is safe on this
      // device, which is where it lived before any of this.
      if (response.status === 501 || response.status === 401) {
        setStatus('off');
        setHasPulled(true);
        return;
      }
      if (!response.ok) {
        throw new Error((await response.json().catch(() => null))?.error ?? 'Pull failed');
      }

      const remote: UserState = UserStateSchema.parse(await response.json());
      if (cancelled) return;

      const store = usePlannerStore.getState();
      const local = {
        settings: settingsFromState(store),
        activities: store.activities,
      };

      const merged = mergeOnFirstPull(local, remote);

      if (remote.isNew || merged.shouldPush) {
        // Nothing up there yet, so this browser's plan becomes the first
        // revision rather than being replaced by an empty one.
        await pushUser({ settings: merged.settings, activities: local.activities });
        if (cancelled) return;
      } else {
        usePlannerStore
          .getState()
          .applyRemoteUser({ settings: merged.settings, activities: remote.activities });
      }

      const after = usePlannerStore.getState();
      syncedRef.current = {
        settings: settingsSignature(settingsFromState(after)),
        activities: activitiesSignature(after.activities),
      };
      isReadyRef.current = true;
      setHasPulled(true);
      setStatus('synced');
    };

    pull().catch((error) => {
      if (cancelled) return;
      console.error('User sync failed', error);
      setStatus('error');
      // The plan is not at risk — it is in `localStorage` either way — so this
      // says what actually broke rather than alarming anyone about their data.
      toast.error('Could not load your settings from the server');
      // Settled, even though it failed. Anything waiting on the pull — making
      // a calendar above all — would otherwise wait forever.
      setHasPulled(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isHydrated, isSignedIn, setStatus, setHasPulled]);

  // Push: settings and activities, debounced, and only when they differ from
  // what the server already told us it has.
  useEffect(() => {
    if (!isHydrated || !isSignedIn) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let isPushing = false;

    const push = async () => {
      if (!isReadyRef.current || isPushing) return;

      const state = usePlannerStore.getState();
      const settings = settingsFromState(state);
      const signatures = {
        settings: settingsSignature(settings),
        activities: activitiesSignature(state.activities),
      };
      const known = syncedRef.current;

      const body: { settings?: unknown; activities?: unknown } = {};
      if (!known || known.settings !== signatures.settings) body.settings = settings;
      if (!known || known.activities !== signatures.activities) {
        body.activities = state.activities;
      }
      if (!body.settings && !body.activities) return;

      isPushing = true;
      setStatus('saving');
      try {
        await pushUser(body);
        syncedRef.current = signatures;
        setStatus('synced');
      } catch (error) {
        console.error('Saving settings failed', error);
        setStatus('error');
      } finally {
        isPushing = false;
      }
    };

    const unsubscribe = usePlannerStore.subscribe((state, previous) => {
      // Only the halves this route owns. Events changing is the calendar's
      // business, and notes and targets are not stored server side yet.
      const hasChanged =
        state.activities !== previous.activities ||
        state.googleCalendarId !== previous.googleCalendarId ||
        state.googleAdoptedAt !== previous.googleAdoptedAt ||
        state.googleSheetId !== previous.googleSheetId ||
        state.weekStartsOn !== previous.weekStartsOn ||
        state.tempUnit !== previous.tempUnit ||
        state.use24HourClock !== previous.use24HourClock ||
        state.defaultStartMinutes !== previous.defaultStartMinutes;
      if (!hasChanged) return;

      clearTimeout(timer);
      timer = setTimeout(push, PUSH_DEBOUNCE_MS);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [isHydrated, isSignedIn, setStatus]);
}
