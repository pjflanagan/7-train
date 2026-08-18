import React, { useState } from 'react';
import clsx from 'clsx';
import { useDraggable } from '@dnd-kit/core';
import { ScheduledEvent } from '@/lib/types';
import { useEventActivity, useUse24HourClock } from '@/hooks/usePlannerSelectors';
import { usePlannerStore } from '@/lib/store';
import { getIconByKey } from '@/lib/icons';
import { formatChipTime, startMinutesOf } from '@/lib/schedule';
import { Select } from '@/components/elements/Select/Select';
import { InlineNumberInput } from '@/components/elements/InlineNumberInput/InlineNumberInput';
import { RemovableCard } from '@/components/elements/RemovableCard/RemovableCard';
import { StravaLink } from '@/components/PlannerPage/StravaLink/StravaLink';
import { DurationField } from './DurationField/DurationField';
import styles from './EventCard.module.scss';
import { COPY } from '@/lib/copy';

export function EventCard({ event }: { event: ScheduledEvent }) {
  const activity = useEventActivity(event);
  const use24Hour = useUse24HourClock();
  // An untyped event reads as the activity itself rather than an empty slot —
  // but inside the open list that same row is the "no type" choice, so it goes
  // back to a dash while the list is up. A native select paints its options from
  // this markup when it opens, so the swap has to happen on the way in.
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const updateEventValue = usePlannerStore(state => state.updateEventValue);
  const setEventSubType = usePlannerStore(state => state.setEventSubType);
  const removeEvent = usePlannerStore(state => state.removeEvent);

  // Draggable, not sortable: a workout is dragged to another day, never into a
  // position within one. A day is ordered by its start times, which come from
  // Google Calendar.
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: event.id,
    // The day travels with the card so whatever is under the pointer can say
    // which column a drop would land in, card or bare column alike.
    data: { kind: 'event', eventId: event.id, day: event.day, weekStart: event.weekStart },
  });

  if (!activity) return null;

  // No transform: what follows the pointer is the drag overlay, and moving the
  // card itself as well would leave a hole in the day and fly a second copy of
  // the workout across the board.
  const style = {
    '--activity-color': activity.color,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  // A workout type removed from the activity is gone from future planning, but
  // an event already tagged with it keeps saying what it was — so the event's
  // own type stays in the list even once the activity has stopped offering it.
  const offered = activity.workoutTypes ?? [];
  const subTypes =
    event.workoutType && !offered.includes(event.workoutType)
      ? [...offered, event.workoutType]
      : offered;
  // An "instance" activity is always one occurrence, so "1 sessions" is noise.
  const hasValue = activity.metric !== 'instance';
  // A duration activity's value is its length, so it never gets a length field
  // of its own — the number below already is one.
  const isDuration = activity.metric === 'duration';

  return (
    <RemovableCard label={COPY.events.remove} onRemove={() => removeEvent(event.id)}>
    <div
      className={styles.card}
      style={style}
      ref={setNodeRef}
    >
      {/* Nothing in the band is editable, so the whole of it is the drag
          handle: it sits darker than the card body and reads as something to
          grab. When the workout starts is Google Calendar's to say — the plan
          only shows what it was told. */}
      <div className={styles.header} {...attributes} {...listeners}>
        <span className={styles.time}>{formatChipTime(startMinutesOf(event), use24Hour)}</span>
        {/* A workout that was actually done says so here, and links out to the
            recording it was done as. */}
        {event.stravaActivityId != null && (
          <StravaLink stravaActivityId={event.stravaActivityId} className={styles.strava} />
        )}
      </div>

      <div className={styles.body}>
        {/* Narrow columns drop the activity name in favour of the workout type,
            so the row carries the full name for hover and the icon for the eye. */}
        <div
          className={clsx(
            styles.identity,
            subTypes.length > 0 && styles.hasSubType,
            // The select is already saying the activity's name; the title
            // beside it would only say it twice.
            subTypes.length > 0 && !event.workoutType && styles.isUntyped
          )}
          title={activity.name}
        >
          {React.createElement(getIconByKey(activity.icon), { className: styles.icon })}
          <span className={styles.title}>{activity.name}</span>
          {subTypes.length > 0 && (
            <Select
              size="sm"
              hideChevron
              className={styles.subtagSelect}
              aria-label={`${activity.name} type`}
              value={event.workoutType || ''}
              onMouseDown={() => setIsPickerOpen(true)}
              onKeyDown={() => setIsPickerOpen(true)}
              onBlur={() => setIsPickerOpen(false)}
              onChange={(e) => {
                setIsPickerOpen(false);
                setEventSubType(event.id, e.target.value);
              }}
            >
              {/* No workout type chosen: the closed control names the activity,
                  the open list offers a dash to clear back to it. */}
              <option value="">{isPickerOpen ? '-' : activity.name}</option>
              {subTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          )}
        </div>

        {/* Both of the card's numbers, on one line: how much of the workout,
            and how long it takes. Every metric has at least one of them — a
            duration activity's value is its length, and an instance activity
            has nothing but one. */}
        <div className={styles.fields}>
          {hasValue && (
            <div className={styles.valueField}>
              <InlineNumberInput
                value={event.value || 0}
                onCommit={(val) => updateEventValue(event.id, val)}
                className={styles.valueInput}
              />
              <span className={styles.unit}>{activity.unit}</span>
            </div>
          )}
          {!isDuration && <DurationField event={event} activity={activity} />}
        </div>
      </div>
    </div>
    </RemovableCard>
  );
}
