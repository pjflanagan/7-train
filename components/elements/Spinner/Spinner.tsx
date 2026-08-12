import React from 'react';
import styles from './Spinner.module.scss';

type Props = {
  /** Optional caption under the spinner. */
  label?: string;
};

/** Indeterminate loading indicator. */
export function Spinner({ label }: Props) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      {label ? <span className={styles.label}>{label}</span> : null}
      <span className={styles.visuallyHidden}>Loading</span>
    </div>
  );
}
