'use client';

import { useEffect, useRef } from 'react';
import { usePlannerStore } from '@/lib/store';
import { useGoogleAccount } from '@/hooks/useAuth';

/**
 * Empties the planner the moment the account goes away.
 *
 * Signing out is not a navigation as far as the store is concerned — the
 * session flips to unauthenticated and React carries on with the same state in
 * memory. Without this, a plan pulled for one account stays on screen for
 * whoever is at the machine next, and worse, is what the *next* sign in pushes
 * up as their activities.
 *
 * Only the true -> false transition counts. A load that starts signed out has
 * nothing to clear, and clearing on every render where nobody is signed in
 * would wipe a backup someone had just imported.
 */
export function useSignedOutReset(): void {
  const { isSignedIn } = useGoogleAccount();
  const wasSignedInRef = useRef(false);

  useEffect(() => {
    if (isSignedIn) {
      wasSignedInRef.current = true;
      return;
    }
    if (!wasSignedInRef.current) return;
    wasSignedInRef.current = false;
    // Nothing is pushed as a consequence: calendar sync has already gone `off`
    // with the session and forgotten what Google holds, so the emptied plan is
    // not read as every workout having been deleted.
    usePlannerStore.getState().clearForSignOut();
  }, [isSignedIn]);
}
