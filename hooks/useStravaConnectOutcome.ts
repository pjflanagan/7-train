'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useStravaConnectionStore } from '@/hooks/useStrava';
import { COPY } from '@/lib/copy';

/**
 * How the trip through Strava's consent screen went.
 *
 * The callback cannot say anything to a page that does not exist yet, so it
 * leaves the outcome in `?strava=`. This says it out loud, re-reads the
 * connection so the modal is right, and takes the parameter back out of the
 * URL — refreshing should not toast a connection that happened minutes ago.
 */

export function useStravaConnectOutcome(): void {
  const refresh = useStravaConnectionStore((state) => state.refresh);
  /** Strict mode mounts effects twice, and one trip deserves one toast. */
  const hasReportedRef = useRef(false);

  useEffect(() => {
    if (hasReportedRef.current) return;

    const url = new URL(window.location.href);
    const outcome = url.searchParams.get('strava');
    if (!outcome) return;
    hasReportedRef.current = true;

    const result = COPY.strava.outcome[outcome as keyof typeof COPY.strava.outcome];
    if (result) {
      if (result.isError) toast.error(result.message);
      else toast.success(result.message);
    }

    if (outcome === 'connected') void refresh();

    url.searchParams.delete('strava');
    window.history.replaceState(null, '', url.toString());
  }, [refresh]);
}
