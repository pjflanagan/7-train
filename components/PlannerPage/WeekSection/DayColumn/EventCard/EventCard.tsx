import React, { useState } from 'react';
import clsx from 'clsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScheduledEvent } from '@/lib/types';
import { useEventActivity } from '@/hooks/usePlannerSelectors';
import { usePlannerStore } from '@/lib/store';
import { getIconByKey } from '@/lib/icons';
import { Select } from '@/components/elements/Select/Select';
import { InlineNumberInput } from '@/components/elements/InlineNumberInput/InlineNumberInput';
import { RemovableCard } from '@/components/elements/RemovableCard/RemovableCard';
import { TimeChip } from './TimeChip/TimeChip';
import styles from './EventCard.module.scss';

export function EventCard({ event }: { event: ScheduledEvent }) {
  const activity = useEventActivity(event);
  // An untyped event reads as the activity itself rather than an empty slot —
  // but inside the open list that same row is the "no type" choice, so it goes
  // back to a dash while the list is up. A native select paints its options from
  // this markup when it opens, so the swap has to happen on the way in.
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const updateEventValue = usePlannerStore(state => state.updateEventValue);
  const setEventSubType = usePlannerStore(state => state.setEventSubType);
  const removeEvent = usePlannerStore(state => state.removeEvent);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: event.id,
    // The day travels with the card so whatever is under the pointer can say
    // which column a drop would land in, card or bare column alike.
    data: { kind: 'event', eventId: event.id, day: event.day, weekStart: event.weekStart },
  });

  if (!activity) return null;

  const style = {
    '--activity-color': activity.color,
    transform: CSS.Transform.toString(transform),
    transition,
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
  // A duration activity's value is its length, so the number entry sits where the
  // length control would be instead of repeating it a line further down.
  const isDuration = activity.metric === 'duration';

  const valueEntry = (
    <div className={styles.valueRow}>
      <InlineNumberInput
        value={event.value || 0}
        onCommit={(val) => updateEventValue(event.id, val)}
        className={styles.valueInput}
      />
      <span className={styles.unit}>{activity.unit}</span>
    </div>
  );

  return (
    <RemovableCard label="Remove event" onRemove={() => removeEvent(event.id)}>
    <div
      className={styles.card}
      style={style}
      ref={setNodeRef}
    >
      {/* The band is the drag handle, so it sits darker than the card body and
          reads as something to grab. */}
      <div className={styles.header} {...attributes} {...listeners}>
        {/* A duration activity's own value already says how long it runs, so
            its card drops the length field — but when it happens is still
            something to set here. */}
        <TimeChip event={event} activity={activity} showDuration={!isDuration} />
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

        {hasValue && valueEntry}
      </div>
    </div>
    </RemovableCard>
  );
}
