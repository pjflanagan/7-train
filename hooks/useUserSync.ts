'use client';

import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { toast } from 'sonner';
import { COPY } from '@/lib/copy';
import { usePlannerStore } from '@/lib/store';
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
 * `_docs/storage.md` for the division of labour.
 *
 * This is now the only way "My activities" ever arrives — the browser caches
 * nothing between loads. Signed out, or on a deployment with no database, the
 * pull settles immediately and the planner stays empty, because there is
 * nobody to have a plan.
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
 *
 * It used to answer `status === 'off' || hasPulled`, which is the same bug
 * `useCalendarSettled` was fixed for and for the same reason: `off` is the
 * store's initial value, and it is also what the pull effect writes while it is
 * still waiting on the session. So on the very first render of a signed in user
 * — the one render that matters — `status` was still the `off` left behind by
 * the signed-out commit, this said "settled", and `useEnsureCalendar` made a
 * calendar in the same tick that the pull which knows about the existing one
 * was setting off. A browser with no `googleCalendarId` of its own is now every
 * browser, so it would fire on every load.
 *
 * `hasPulled` is the only positive evidence that the question was actually
 * asked, and every way the pull can end sets it — including 501 no database,
 * 401, and an outright failure. So a signed in user waits on that and nothing
 * else. The remaining cases are read live during render rather than out of a
 * status an effect writes a commit later, because that lag *was* the bug.
 */
export function useUserSettled(): boolean {
  const hasPulled = useUserSyncStore((state) => state.hasPulled);
  const { isSignedIn, isLoading } = useGoogleAccount();

  if (hasPulled) return true;
  // Mid-flight. Signed out has to be *known*, not merely not-yet-authenticated.
  if (isLoading) return false;
  // Nobody to ask about, so there is no answer coming and none needed.
  return !isSignedIn;
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

  const setStatus = useUserSyncStore((state) => state.setStatus);
  const setHasPulled = useUserSyncStore((state) => state.setHasPulled);

  /** What the server already holds, so an unchanged push is never sent. */
  const syncedRef = useRef<{ settings: string; activities: string } | null>(null);
  /** Pushing before the pull lands would fight it, so it waits. */
  const isReadyRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn) {
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
      // mid-flight. Neither is an error worth showing, and neither loses
      // anything: what the server holds is untouched, this load just has no way
      // to read it.
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

      // Nobody has ever synced this account. This used to be the moment a
      // browser's own plan became the first revision; there is no such plan any
      // more, so the sample week is seeded here and becomes it — otherwise
      // signing up lands on an empty grid with nothing to edit.
      if (remote.isNew) usePlannerStore.getState().resetAll();

      const store = usePlannerStore.getState();
      const merged = mergeOnFirstPull(
        { settings: settingsFromState(store), activities: store.activities },
        remote
      );

      if (remote.isNew) {
        await pushUser({ settings: merged.settings, activities: merged.activities });
        if (cancelled) return;
      } else {
        store.applyRemoteUser({ settings: merged.settings, activities: remote.activities });

        // The merge may have taught the server something it did not know —
        // only ever a setting. The activities are deliberately not sent back:
        // this browser holds nothing the server did not just give it, so a
        // push of them could only ever overwrite the real list with less.
        if (merged.shouldPush) {
          await pushUser({ settings: merged.settings });
          if (cancelled) return;
        }
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
      // Nothing was lost — the plan is on the server, this load just did not
      // get it — so this says what actually broke rather than alarming anyone
      // about their data.
      toast.error(COPY.user.loadFailed);
      // Settled, even though it failed. Anything waiting on the pull — making
      // a calendar above all — would otherwise wait forever.
      setHasPulled(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, setStatus, setHasPulled]);

  // Push: settings and activities, debounced, and only when they differ from
  // what the server already told us it has.
  useEffect(() => {
    if (!isSignedIn) return;

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
  }, [isSignedIn, setStatus]);
}
