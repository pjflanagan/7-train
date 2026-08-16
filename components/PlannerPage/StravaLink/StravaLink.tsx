'use client';

import React from 'react';
import clsx from 'clsx';
import { FaStrava } from 'react-icons/fa6';
import { stravaActivityUrl } from '@/lib/strava';
import { useIsStravaConfigured } from '@/hooks/useAuth';
import styles from './StravaLink.module.scss';
import { COPY } from '@/lib/copy';

export interface StravaLinkProps {
  stravaActivityId: number;
  className?: string;
}

/**
 * The way out to the full recording — splits, heart rate, the map — none of
 * which belongs on a card this size.
 *
 * On the desktop card this sits inside the drag handle, so it stops the pointer
 * from reaching dnd-kit: pressing a link should follow it, not pick the workout
 * up and drop it somewhere else.
 *
 * Gated here rather than at the two call sites, so the kill switch reaches both
 * the desktop card and the mobile feed from one place. An event keeps its
 * `stravaActivityId` either way — the switch hides Strava, it does not edit the
 * plan — so turning it back on restores every link.
 */
export function StravaLink({ stravaActivityId, className }: StravaLinkProps) {
  const isStravaConfigured = useIsStravaConfigured();
  if (!isStravaConfigured) return null;

  return (
    <a
      className={clsx(styles.link, className)}
      href={stravaActivityUrl(stravaActivityId)}
      target="_blank"
      rel="noreferrer noopener"
      title={COPY.events.viewOnStrava}
      aria-label={COPY.events.viewOnStrava}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <FaStrava aria-hidden="true" />
    </a>
  );
}
