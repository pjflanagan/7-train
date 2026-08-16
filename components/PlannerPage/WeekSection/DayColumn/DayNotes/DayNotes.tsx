import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNote } from '@/hooks/usePlannerSelectors';
import { usePlannerStore } from '@/lib/store';
import { DAYS } from '@/lib/constants';
import { Textarea } from '@/components/elements/Textarea/Textarea';
import styles from './DayNotes.module.scss';
import { COPY } from '@/lib/copy';

export function DayNotes({ day, weekStart }: { day: typeof DAYS[number]; weekStart: string }) {
  const note = useNote(day, weekStart);
  const setNote = usePlannerStore(state => state.setNote);
  const [prevNote, setPrevNote] = useState(note);
  const [localNote, setLocalNote] = useState(note || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (note !== prevNote) {
    setPrevNote(note);
    setLocalNote(note || '');
  }

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    resize();
  }, [localNote]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localNote !== (note || '')) {
        setNote(day, weekStart, localNote);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [localNote, day, weekStart, note, setNote]);

  return (
    <Textarea
      ref={textareaRef}
      value={localNote}
      onChange={(e) => setLocalNote(e.target.value)}
      placeholder={COPY.week.notesPlaceholder}
      className={styles.notes}
      rows={1}
    />
  );
}