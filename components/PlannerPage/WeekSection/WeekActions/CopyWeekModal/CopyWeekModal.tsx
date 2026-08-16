'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/elements/Modal/Modal';
import { Button } from '@/components/elements/Button/Button';
import { Checkbox } from '@/components/elements/Checkbox/Checkbox';
import { SegmentedControl } from '@/components/elements/SegmentedControl/SegmentedControl';
import styles from './CopyWeekModal.module.scss';
import { COPY } from '@/lib/copy';

export type CopySource = 'current' | 'previous' | 'default';

interface CopyWeekModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which source weeks this week is allowed to pull from. */
  sources: CopySource[];
  onCopy: (
    source: CopySource,
    parts: { schedule: boolean; notes: boolean; activities: boolean }
  ) => void;
}

const sourceLabels: Record<CopySource, string> = {
  current: COPY.week.source.current,
  previous: COPY.week.source.previous,
  default: COPY.week.source.default,
};

/** Picks a source week and which parts of it — schedule, activities, or both — to pull in. */
export function CopyWeekModal({ isOpen, onClose, sources, onCopy }: CopyWeekModalProps) {
  const [source, setSource] = useState<CopySource>(sources[0] ?? 'current');
  const [activities, setActivities] = useState(true);
  const [schedule, setSchedule] = useState(true);
  const [notes, setNotes] = useState(false);

  // Reopening starts fresh rather than resuming whatever was half-picked last time.
  useEffect(() => {
    if (isOpen) {
      setSource(sources[0] ?? 'current');
      setActivities(true);
      setSchedule(true);
      setNotes(false);
    }
  }, [isOpen, sources]);

  const nothingSelected = !schedule && !notes && !activities;
  const isDefault = source === 'default';

  // The template has no schedule or notes to bring along, so those
  // options are moot there.
  useEffect(() => {
    if (isDefault) {
      setSchedule(false);
      setNotes(false);
    }
  }, [isDefault]);

  const handleCopy = () => {
    if (nothingSelected) return;
    onCopy(source, {
      schedule: isDefault ? false : schedule,
      notes: isDefault ? false : notes,
      activities,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={COPY.week.fill}
      maxWidth="420px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCopy} disabled={nothingSelected}>
            Fill
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.group}>
          <span className={styles.legend}>Copy from</span>
          <SegmentedControl
            name="copy-source"
            value={source}
            onChange={setSource}
            options={sources.map((option) => ({ value: option, label: sourceLabels[option] }))}
          />
        </div>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Copy what</legend>
          <Checkbox
            label={COPY.week.copyActivities}
            checked={activities}
            onChange={(e) => setActivities(e.target.checked)}
          />
          <Checkbox
            label={COPY.week.copySchedule}
            checked={schedule && !isDefault}
            disabled={isDefault}
            onChange={(e) => setSchedule(e.target.checked)}
          />
          <Checkbox
            label={COPY.week.copyNotes}
            checked={notes && !isDefault}
            disabled={isDefault}
            onChange={(e) => setNotes(e.target.checked)}
          />
        </fieldset>

        <p className={styles.warning}>
          Whatever you copy overwrites what this week already has.
        </p>
      </div>
    </Modal>
  );
}
