'use client';

import React from 'react';
import { usePlannerStore } from '@/lib/store';
import { ScheduledEvent } from '@/lib/types';
import {
  useEvent,
  useEventActivity,
  useWeekStartsOn,
} from '@/hooks/usePlannerSelectors';
import { Modal } from '@/components/elements/Modal/Modal';
import { Button } from '@/components/elements/Button/Button';
import { Select } from '@/components/elements/Select/Select';
import { InlineNumberInput } from '@/components/elements/InlineNumberInput/InlineNumberInput';
import { dateForDay, formatDateLocal, slotForDate } from '@/lib/dates';
import { clampDuration, durationMinutesOf } from '@/lib/schedule';
import styles from './EditEventModal.module.scss';
import { COPY } from '@/lib/copy';

export interface EditEventModalProps {
  /** Held by id, not by value, so the editor survives the workout moving. */
  eventId: string | null;
  onClose: () => void;
}

/**
 * How a phone edits a workout: which date it lands on, what kind it is, how
 * much of it, and how long it runs. The week board does all of this in place —
 * a card has room for its own controls and a pointer to drag it with — but a
 * day feed row has neither, so the controls get a sheet of their own.
 *
 * Deliberately not here: when the workout starts. That is Google Calendar's,
 * everywhere in the app.
 */
export function EditEventModal({ eventId, onClose }: EditEventModalProps) {
  const event = useEvent(eventId);
  // Gone from under us — deleted from in here, or by another device mid-edit.
  // Resolved before the editor mounts so the editor itself always has one.
  if (!event) return null;
  return <EventEditor event={event} onClose={onClose} />;
}

function EventEditor({ event, onClose }: { event: ScheduledEvent; onClose: () => void }) {
  const activity = useEventActivity(event);
  const weekStartsOn = useWeekStartsOn();
  const moveEvent = usePlannerStore((state) => state.moveEvent);
  const removeEvent = usePlannerStore((state) => state.removeEvent);
  const updateEventValue = usePlannerStore((state) => state.updateEventValue);
  const setEventSubType = usePlannerStore((state) => state.setEventSubType);
  const setEventDuration = usePlannerStore((state) => state.setEventDuration);

  // An event whose activity is gone entirely: nothing to describe it with,
  // and nothing sensible to edit.
  if (!activity) return null;

  const dateKey = formatDateLocal(dateForDay(event.weekStart, event.day, weekStartsOn));

  // A workout type the activity has stopped offering still describes an event
  // already tagged with it, so it stays in this list.
  const offered = activity.workoutTypes ?? [];
  const subTypes =
    event.workoutType && !offered.includes(event.workoutType)
      ? [...offered, event.workoutType]
      : offered;

  const hasValue = activity.metric !== 'instance';
  // A duration activity's value is its length; a second field would be the
  // same fact twice.
  const isDuration = activity.metric === 'duration';

  const move = (nextDateKey: string) => {
    if (!nextDateKey || nextDateKey === dateKey) return;
    const { day, weekStart } = slotForDate(nextDateKey, weekStartsOn);
    moveEvent(event.id, day, weekStart);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={activity.name}
      maxWidth="420px"
      footer={
        <div className={styles.footer}>
          <Button
            variant="danger"
            onClick={() => {
              removeEvent(event.id);
              onClose();
            }}
          >
            {COPY.events.remove}
          </Button>
          <Button variant="primary" onClick={onClose}>{COPY.events.done}</Button>
        </div>
      }
    >
      <div className={styles.rows}>
        <label className={styles.row}>
          <span className={styles.label}>{COPY.events.date}</span>
          {/* The whole of moving a workout on a phone: pick the day it lands
              on and the week follows from it. */}
          <input
            type="date"
            className={styles.dateInput}
            value={dateKey}
            onChange={(e) => move(e.target.value)}
          />
        </label>

        {subTypes.length > 0 && (
          <div className={styles.row}>
            <span className={styles.label}>{COPY.events.workoutType}</span>
            <Select
              className={styles.control}
              aria-label={`${activity.name} type`}
              value={event.workoutType || ''}
              onChange={(e) => setEventSubType(event.id, e.target.value)}
            >
              <option value="">{COPY.events.noType}</option>
              {subTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>
          </div>
        )}

        {hasValue && (
          <label className={styles.row}>
            {/* A duration activity's value _is_ its length, so it takes the
                length row's name and there is no second one below. */}
            <span className={styles.label}>
              {isDuration ? COPY.events.length : COPY.events.distance}
            </span>
            <span className={styles.withUnit}>
              <InlineNumberInput
                className={styles.numberInput}
                // A text input with a number keypad: the value is committed on
                // blur, which a stepper's spinner fights with on touch.
                inputMode="decimal"
                value={event.value || 0}
                onCommit={(val) => updateEventValue(event.id, val)}
              />
              <span className={styles.unit}>{activity.unit}</span>
            </span>
          </label>
        )}

        {!isDuration && (
          <label className={styles.row}>
            <span className={styles.label}>{COPY.events.length}</span>
            <span className={styles.withUnit}>
              <InlineNumberInput
                className={styles.numberInput}
                inputMode="numeric"
                value={durationMinutesOf(event, activity)}
                onCommit={(val) => setEventDuration(event.id, clampDuration(val))}
                aria-label={COPY.events.lengthLabel}
              />
              <span className={styles.unit}>{COPY.events.minutes}</span>
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
}
