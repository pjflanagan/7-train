import React from 'react';
import styles from './MetroCardSwipe.module.scss';

type Props = {
  /** Dot-matrix readout under the reader. */
  label?: string;
};

/** Loading indicator: a MetroCard swiped right-to-left through a turnstile. */
export function MetroCardSwipe({ label = 'Go' }: Props) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.reader} aria-hidden="true">
        <div className={styles.slot} />
        <div className={styles.card}>
          <span className={styles.brand}>MetroCard</span>
          <span className={styles.stripe} />
        </div>
      </div>
      <span className={styles.readout}>{label}</span>
      <span className={styles.visuallyHidden}>Loading</span>
    </div>
  );
}
