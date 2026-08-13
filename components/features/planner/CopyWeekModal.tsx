'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/elements/Modal/Modal';
import { Button } from '@/components/elements/Button/Button';
import { Checkbox } from '@/components/elements/Checkbox/Checkbox';
import styles from './CopyWeekModal.module.scss';

export type CopySource = 'current' | 'previous';

interface CopyWeekModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which source weeks this week is allowed to pull from. */
  sources: CopySource[];
  onCopy: (source: CopySource, parts: { schedule: boolean; goals: boolean }) => void;
}

const sourceLabels: Record<CopySource, string> = {
  current: 'Current week',
  previous: 'Previous week',
};

/** Picks a source week and which parts of it — schedule, goals, or both — to pull in. */
export function CopyWeekModal({ isOpen, onClose, sources, onCopy }: CopyWeekModalProps) {
  const [source, setSource] = useState<CopySource>(sources[0] ?? 'current');
  const [schedule, setSchedule] = useState(true);
  const [goals, setGoals] = useState(true);

  // Reopening starts fresh rather than resuming whatever was half-picked last time.
  useEffect(() => {
    if (isOpen) {
      setSource(sources[0] ?? 'current');
      setSchedule(true);
      setGoals(true);
    }
  }, [isOpen, sources]);

  const nothingSelected = !schedule && !goals;

  const handleCopy = () => {
    if (nothingSelected) return;
    onCopy(source, { schedule, goals });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Copy week" maxWidth="420px">
      <div className={styles.body}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Copy from</legend>
          {sources.map((option) => (
            <label key={option} className={styles.radioRow}>
              <input
                type="radio"
                name="copy-source"
                value={option}
                checked={source === option}
                onChange={() => setSource(option)}
              />
              <span>{sourceLabels[option]}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Copy what</legend>
          <Checkbox
            label="Schedule (workouts and notes)"
            checked={schedule}
            onChange={(e) => setSchedule(e.target.checked)}
          />
          <Checkbox
            label="Goals (weekly targets)"
            checked={goals}
            onChange={(e) => setGoals(e.target.checked)}
          />
        </fieldset>

        <p className={styles.warning}>
          Whatever you copy overwrites what this week already has.
        </p>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCopy} disabled={nothingSelected}>
            Copy
          </Button>
        </div>
      </div>
    </Modal>
  );
}
