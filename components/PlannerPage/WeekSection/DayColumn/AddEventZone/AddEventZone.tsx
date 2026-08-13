'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DAYS } from '@/lib/constants';
import { usePlannerStore } from '@/lib/store';
import { getIconByKey } from '@/lib/icons';
import styles from './AddEventZone.module.scss';

/** Roughly how wide the picker is, so it can be kept inside the viewport. */
const PANEL_WIDTH = 220;
const VIEWPORT_MARGIN = 8;

export interface AddEventZoneProps {
  day: typeof DAYS[number];
  weekStart: string;
}

/**
 * The empty half of a day: a drop target for dragged activities, and — because the
 * activity strip only exists on the current week — the way to add a workout to a
 * week whose strip is nowhere on screen.
 *
 * The picker is portalled rather than anchored inline: a day column is narrower
 * than the list, and the week board clips its own overflow.
 */
export function AddEventZone({ day, weekStart }: AddEventZoneProps) {
  const activities = usePlannerStore((state) => state.activities);
  const addEvent = usePlannerStore((state) => state.addEvent);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!anchor) return;

    const close = () => setAnchor(null);
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    // The panel is pinned to the viewport, so anything that moves the column
    // out from under it has to dismiss it rather than leave it floating.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [anchor]);

  const open = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({
      top: rect.top,
      left: Math.min(rect.left, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN),
    });
  };

  return (
    <>
      <button
        type="button"
        className={styles.zone}
        onClick={open}
        aria-label={`Add a workout to ${day}`}
        aria-haspopup="menu"
        aria-expanded={anchor != null}
      />

      {anchor &&
        createPortal(
          <div
            className={styles.panel}
            style={{ top: anchor.top, left: anchor.left, width: PANEL_WIDTH }}
            role="menu"
            aria-label="Add an event"
            ref={panelRef}
          >
            {activities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                role="menuitem"
                className={styles.option}
                onClick={() => {
                  addEvent({ typeId: activity.id, day, weekStart, value: 1 });
                  setAnchor(null);
                }}
              >
                <span className={styles.optionIcon} style={{ color: activity.color }}>
                  {React.createElement(getIconByKey(activity.icon))}
                </span>
                <span className={styles.optionLabel}>{activity.name}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
