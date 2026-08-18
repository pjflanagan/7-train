'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { DAYS } from '@/lib/constants';
import { usePlannerStore } from '@/lib/store';
import { useWeekActivities } from '@/hooks/usePlannerSelectors';
import { getIconByKey } from '@/lib/icons';
import { defaultEventValue } from '@/lib/progress';
import styles from './AddEventZone.module.scss';
import { COPY } from '@/lib/copy';

/** Narrowest the picker gets, whatever the slot it was opened from. */
const MIN_PANEL_WIDTH = 220;
const VIEWPORT_MARGIN = 8;

export interface AddEventZoneProps {
  day: typeof DAYS[number];
  weekStart: string;
  /**
   * The empty slot itself. The week board's is a wordless dashed strip in a
   * column; the day feed's is a full-width row that has to say what it is,
   * because a phone has no hover to explain it.
   */
  className?: string;
  label?: string;
}

/**
 * An empty slot: tap it, pick a workout, and it lands on the day. On the week
 * board it doubles as somewhere to drop a dragged card, and — because the
 * target strip only exists on the current week — it is also the way to add a
 * workout to a week whose strip is nowhere on screen. Stays on screen even once
 * a day has events, so there is always another slot to fill.
 *
 * The picker is portalled rather than anchored inline: a day column is narrower
 * than the list, and both the week board and the day feed clip their own
 * overflow.
 */
export function AddEventZone({ day, weekStart, className, label }: AddEventZoneProps) {
  // Only what this week is aiming at: scheduling is planning against the
  // week's own activities, not against the "My activities" template.
  const activities = useWeekActivities(weekStart);
  const addEvent = usePlannerStore((state) => state.addEvent);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
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
    // The panel is pinned to the viewport, so anything that moves the slot
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

  // A slot low on the screen — which on a phone is most of them — would hang
  // the list off the bottom of the viewport. How tall the list actually is
  // depends on how many activities the week has, so it is measured once it is
  // up rather than guessed at from the slot's position.
  useLayoutEffect(() => {
    if (!anchor || !panelRef.current) return;
    const { height } = panelRef.current.getBoundingClientRect();
    const lowest = window.innerHeight - VIEWPORT_MARGIN - height;
    const top = Math.max(VIEWPORT_MARGIN, Math.min(anchor.top, lowest));
    if (top !== anchor.top) setAnchor({ ...anchor, top });
  }, [anchor]);

  const open = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // The picker takes the slot's own width, so the day feed's full-width row
    // opens a full-width list rather than a narrow column of one placed over a
    // phone screen. A slot narrower than the list still gets the list's width.
    const width = Math.min(
      Math.max(MIN_PANEL_WIDTH, rect.width),
      window.innerWidth - VIEWPORT_MARGIN * 2
    );
    setAnchor({
      width,
      top: rect.top,
      left: Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN)
      ),
    });
  };

  return (
    <>
      <button
        type="button"
        className={clsx(styles.zone, className)}
        onClick={open}
        aria-label={`Add a workout to ${day}`}
        aria-haspopup="menu"
        aria-expanded={anchor != null}
      >
        {label}
      </button>

      {anchor &&
        createPortal(
          <div
            className={styles.panel}
            style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
            role="menu"
            aria-label={COPY.events.add}
            ref={panelRef}
          >
            {activities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                role="menuitem"
                className={styles.option}
                onClick={() => {
                  addEvent({
                    typeId: activity.id,
                    day,
                    weekStart,
                    value: defaultEventValue(activity, activities)
                  });
                  setAnchor(null);
                }}
              >
                <span className={styles.optionIcon} style={{ color: activity.color }}>
                  {React.createElement(getIconByKey(activity.icon))}
                </span>
                <span className={styles.optionLabel}>{activity.name}</span>
              </button>
            ))}
            {/* A week nobody has set targets on has nothing to offer, and an
                empty menu reads as a broken one. */}
            {activities.length === 0 && (
              <p className={styles.emptyPicker}>{COPY.events.noActivities}</p>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
