'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePlannerStore } from '@/lib/store';
import { MAX_EVENT_NOTE_LENGTH } from '@/lib/constants';
import { Textarea } from '@/components/elements/Textarea/Textarea';
import styles from './EventNote.module.scss';
import { COPY } from '@/lib/copy';

/**
 * A line about the workout, at the bottom of its card.
 *
 * This is where the day notes went. A note about a session belongs to the
 * session — it follows the workout when it is dragged to another day, and it
 * goes to Google Calendar with it, which the day notes never had anywhere to do.
 *
 * Typed locally and committed on a pause, like the note box before it: the
 * store is what both sync loops watch, so a keystroke each is a write each.
 */
export function EventNote({ eventId, note }: { eventId: string; note: string | undefined }) {
  const setEventNote = usePlannerStore((state) => state.setEventNote);
  const stored = note ?? '';
  const [prevStored, setPrevStored] = useState(stored);
  const [draft, setDraft] = useState(stored);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A pull, or an edit on another device, replaces what is being shown —
  // unless it is this browser's own edit coming back, which the draft already
  // says.
  if (stored !== prevStored) {
    setPrevStored(stored);
    setDraft(stored);
  }

  // One line until there is more to say, then as many as it takes.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (draft !== stored) setEventNote(eventId, draft);
    }, 500);
    return () => clearTimeout(handle);
  }, [draft, stored, eventId, setEventNote]);

  return (
    <Textarea
      ref={textareaRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      // Committed on blur as well, so a note typed and immediately dragged
      // elsewhere is not lost with the unmounted card.
      onBlur={() => setEventNote(eventId, draft)}
      placeholder={COPY.events.notePlaceholder}
      aria-label={COPY.events.note}
      maxLength={MAX_EVENT_NOTE_LENGTH}
      className={styles.note}
      rows={1}
    />
  );
}
