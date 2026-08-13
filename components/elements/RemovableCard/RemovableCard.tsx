'use client';

import React from 'react';
import clsx from 'clsx';
import { MdClose } from 'react-icons/md';
import styles from './RemovableCard.module.scss';

export interface RemovableCardProps {
  /** What the badge is for, e.g. "Remove event" — the button's accessible name. */
  label: string;
  onRemove: () => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps a card in a remove badge — a small x on a circle notched off its top
 * right corner, the way an unread count sits on an icon. It waits until the
 * card is hovered so a board full of cards isn't also a board full of x's.
 *
 * The badge sits outside the card's own bounds on purpose: cards round and clip
 * their contents, and a control tucked inside one competes with what the card
 * is actually saying.
 */
export function RemovableCard({ label, onRemove, className, children }: RemovableCardProps) {
  return (
    <div className={clsx(styles.wrapper, className)}>
      {children}
      <button
        type="button"
        className={styles.badge}
        aria-label={label}
        title={label}
        // Cards are drag handles, so the badge has to keep its own pointer
        // events from starting a drag.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <MdClose />
      </button>
    </div>
  );
}
