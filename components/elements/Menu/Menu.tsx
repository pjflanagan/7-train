'use client';

import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import styles from './Menu.module.scss';

export interface MenuProps {
  isOpen: boolean;
  onClose: () => void;
  /** The button that opens the menu. Kept inside so outside clicks are easy to spot. */
  trigger: React.ReactNode;
  /** Which edge of the trigger the panel lines up with. */
  align?: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

/** A dropdown panel anchored to its trigger. Open state lives with the caller. */
export const Menu: React.FC<MenuProps> = ({
  isOpen,
  onClose,
  trigger,
  align = 'right',
  children,
  className,
  'aria-label': ariaLabel,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div className={clsx(styles.wrapper, className)} ref={wrapperRef}>
      {trigger}
      {isOpen && (
        <div
          className={clsx(styles.panel, styles[align])}
          role="menu"
          aria-label={ariaLabel}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export const MenuItem: React.FC<MenuItemProps> = ({ icon, children, className, ...props }) => (
  <button type="button" role="menuitem" className={clsx(styles.item, className)} {...props}>
    {icon && <span className={styles.itemIcon}>{icon}</span>}
    <span className={styles.itemLabel}>{children}</span>
  </button>
);
