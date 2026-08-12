'use client';

import React, { useId } from 'react';
import { useWeekProgress } from '@/hooks/useWeekProgress';
import styles from './WeekProgressBar.module.scss';

// A single hand-swiped streak, drawn once and painted twice: grey underneath
// for the whole week, purple over the portion that's done.
const STREAK = 'M8,15 C70,8 130,21 200,12 C268,4 336,18 392,10';

export function WeekProgressBar({ weekStart }: { weekStart: string }) {
  const { overall } = useWeekProgress(weekStart);
  const percent = Math.min(100, Math.max(0, overall.percent));
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const rough = `rough-${uid}`;
  const mist = `mist-${uid}`;
  const clip = `clip-${uid}`;

  return (
    <div className={styles.container} role="progressbar" aria-valuenow={Math.round(percent)}
      aria-valuemin={0} aria-valuemax={100} aria-label="Week progress">
      <svg className={styles.streak} viewBox="0 0 400 26" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          {/* Ragged, bled edges — the can never lays down a clean line. */}
          <filter id={rough} x="-20%" y="-60%" width="140%" height="220%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045 0.11" numOctaves="3" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
          {/* Overspray: fine speckle drifting off the edge of the stroke. */}
          <filter id={mist} x="-25%" y="-90%" width="150%" height="280%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="g" />
            <feColorMatrix in="g" type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 9 0 -4.2" result="dots" />
            <feComposite in="dots" in2="SourceAlpha" operator="in" />
          </filter>
          <clipPath id={clip}>
            {/* Extends off the left edge so only the leading corner rounds —
                the streak ends in a cap rather than a guillotined vertical. */}
            <rect x={-20} y="0" width={20 + (percent / 100) * 400} height="26" rx="13" ry="13" />
          </clipPath>
        </defs>

        <g className={styles.grey}>
          <path d={STREAK} strokeWidth="15" opacity="0.28" filter={`url(#${mist})`} />
          <path d={STREAK} strokeWidth="13" opacity="0.3" filter={`url(#${rough})`} />
          <path d={STREAK} strokeWidth="8" opacity="0.85" filter={`url(#${rough})`} />
        </g>

        <g className={styles.purple} clipPath={`url(#${clip})`}>
          <path d={STREAK} strokeWidth="16" opacity="0.35" filter={`url(#${mist})`} />
          <path d={STREAK} strokeWidth="13" opacity="0.45" filter={`url(#${rough})`} />
          <path d={STREAK} strokeWidth="8" opacity="0.95" filter={`url(#${rough})`} />
        </g>
      </svg>
      <span className={styles.label}>{Math.round(percent)}%</span>
    </div>
  );
}
