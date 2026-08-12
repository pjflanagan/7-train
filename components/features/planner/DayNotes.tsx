import React, { useState, useEffect } from 'react';
import { useNote } from '../../../hooks/usePlannerStore';
import { usePlannerStore } from '../../../lib/store';
import { DAYS } from '../../../lib/constants';
import { Textarea } from '../../elements/Textarea/Textarea';
import styles from './DayNotes.module.scss';

export function DayNotes({ day, week }: { day: typeof DAYS[number]; week: 1 | 2 }) {
  const note = useNote(day, week);
  const setNote = usePlannerStore(state => state.setNote);
  const [prevNote, setPrevNote] = useState(note);
  const [localNote, setLocalNote] = useState(note || '');

  if (note !== prevNote) {
    setPrevNote(note);
    setLocalNote(note || '');
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localNote !== (note || '')) {
        setNote(day, week, localNote);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [localNote, day, week, note, setNote]);

  return (
    <Textarea
      value={localNote}
      onChange={(e) => setLocalNote(e.target.value)}
      placeholder="Notes..."
      className={styles.notes}
    />
  );
}