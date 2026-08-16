import React from 'react';
import clsx from 'clsx';
import { STRAVA_SPORTS, STRAVA_SPORT_GROUPS } from '@/lib/stravaSports';
import { COPY } from '@/lib/copy';
import styles from './StravaSportPicker.module.scss';

export interface StravaSportPickerProps {
  /** The sports this activity answers to. */
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Which Strava sports an activity answers to.
 *
 * A flat list of fifty is unreadable, so they are grouped the way someone
 * thinks about them rather than the way Strava lists them. A sport can be on
 * more than one activity — nothing here stops it — because which of them a
 * recording lands on is settled by what was planned that day, not here.
 */
export function StravaSportPicker({ value, onChange }: StravaSportPickerProps) {
  const selected = new Set(value);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Kept in the canonical order rather than the order they were clicked, so
    // two activities with the same sports store the same thing.
    onChange(STRAVA_SPORTS.filter((sport) => next.has(sport.id)).map((sport) => sport.id));
  };

  return (
    <div className={styles.picker}>
      {STRAVA_SPORT_GROUPS.map((group) => (
        <fieldset className={styles.group} key={group}>
          <legend className={styles.groupTitle}>{COPY.strava.sportGroup[group]}</legend>
          <div className={styles.sports}>
            {STRAVA_SPORTS.filter((sport) => sport.group === group).map((sport) => (
              <label
                key={sport.id}
                className={clsx(styles.sport, selected.has(sport.id) && styles.isOn)}
              >
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={selected.has(sport.id)}
                  onChange={() => toggle(sport.id)}
                />
                {sport.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
