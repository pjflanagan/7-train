'use client';

import React from 'react';
import clsx from 'clsx';
import { MdClose, MdEdit } from 'react-icons/md';
import styles from './RemovableCard.module.scss';

export interface RemovableCardProps {
  /** What the badge is for, e.g. "Remove event" — the button's accessible name. */
  label: string;
  onRemove: () => void;
  /** Adds a pencil badge alongside the remove one, when the card is editable. */
  onEdit?: () => void;
  editLabel?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps a card in its own controls: a remove badge, and optionally an edit one.
 * Each is a small circle notched off the card's top right corner, the way an
 * unread count sits on an icon. They wait until the card is hovered, so a board
 * full of cards isn't also a board full of buttons.
 *
 * The badges sit outside the card's own bounds on purpose: cards round and clip
 * their contents, and a control tucked inside one competes with what the card
 * is actually saying.
 */
export function RemovableCard({
  label,
  onRemove,
  onEdit,
  editLabel = 'Edit',
  className,
  children,
}: RemovableCardProps) {
  // Cards are drag handles, so a badge has to keep its own pointer events from
  // starting a drag.
  const badgeProps = (action: () => void, variant: string) => ({
    type: 'button' as const,
    className: clsx(styles.badge, variant),
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      action();
    },
  });

  return (
    <div className={clsx(styles.wrapper, className)}>
      {children}
      <div className={styles.badges}>
        {onEdit && (
          <button {...badgeProps(onEdit, styles.edit)} aria-label={editLabel} title={editLabel}>
            <MdEdit />
          </button>
        )}
        <button {...badgeProps(onRemove, styles.remove)} aria-label={label} title={label}>
          <MdClose />
        </button>
      </div>
    </div>
  );
}
