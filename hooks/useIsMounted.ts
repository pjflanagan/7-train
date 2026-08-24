'use client';

import { useSyncExternalStore } from 'react';

/** Nothing to subscribe to: mounting is the only transition there is. */
const subscribeToNothing = () => () => {};

/**
 * False through SSR and the hydrating render, true afterwards.
 *
 * The shape `useSyncExternalStore` exists for, and React's own way of saying
 * "this render has to match the server's". Anything that would otherwise answer
 * differently on the server than in the browser — `matchMedia`, `new Date()` in
 * the user's zone, a session that has not been fetched yet — waits behind it.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
}
