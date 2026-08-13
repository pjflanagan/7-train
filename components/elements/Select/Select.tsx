'use client';
import React from 'react';
import clsx from 'clsx';
import { MdKeyboardArrowDown } from 'react-icons/md';
import styles from './Select.module.scss';

// The native `size` attribute (a visible-row count for list boxes) is dropped
// in favour of the shared control sizing every other element here uses.
export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  /** `sm` is the compact inline form used on cards; `md` matches the text inputs. */
  size?: 'sm' | 'md';
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  size = 'md',
  className,
  id,
  ...props
}) => {
  const generatedId = React.useId();
  const selectId = id || generatedId;

  return (
    <div className={clsx(styles.wrapper, className)}>
      {label && <label htmlFor={selectId} className={styles.label}>{label}</label>}
      {/* The native arrow varies by platform, so it is turned off and drawn
          here instead — one chevron, in the theme's own colours. */}
      <div className={styles.control}>
        <select
          id={selectId}
          className={clsx(styles.select, styles[size], error && styles.hasError)}
          {...props}
        />
        <MdKeyboardArrowDown className={styles.chevron} aria-hidden="true" />
      </div>
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
};
