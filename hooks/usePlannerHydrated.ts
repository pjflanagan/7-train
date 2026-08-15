'use client';

import { useSyncExternalStore } from 'react';
import { usePlannerStore } from '@/lib/store';

/**
 * True once the persisted plan is actually in the store.
 *
 * Two traps, both of which this exists to avoid:
 *
 * - `persist.hasHydrated()` is a plain read, not a subscription. Asking once
 *   during a render that happens to be too early leaves the caller stuck on
 *   `false` with nothing to re-render it.
 * - `usePlannerStore.persist` does not exist at all on the server: zustand's
 *   persist middleware bails out early when it has no storage to talk to, and
 *   `window.localStorage` is not there during SSR.
 *
 * Hydration is external state that changes on its own, which is exactly what
 * `useSyncExternalStore` is for — and it takes a separate server answer, so the
 * server can say "not yet" without the client having to pretend for a frame.
 */

function subscribe(onChange: () => void): () => void {
  const persist = usePlannerStore.persist;
  if (!persist) return () => {};
  return persist.onFinishHydration(onChange);
}

/** On the client with no persistence there is nothing to wait for. */
const getSnapshot = () => usePlannerStore.persist?.hasHydrated() ?? true;

/** The server has no storage, and so has nothing hydrated. */
const getServerSnapshot = () => false;

export function usePlannerHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
