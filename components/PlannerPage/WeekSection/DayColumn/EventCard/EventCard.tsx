import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScheduledEvent } from '@/lib/types';
import { useActivity } from '@/hooks/usePlannerSelectors';
import { usePlannerStore } from '@/lib/store';
import { getIconByKey } from '@/lib/icons';
import { Select } from '@/components/elements/Select/Select';
import { InlineNumberInput } from '@/components/elements/InlineNumberInput/InlineNumberInput';
import { MdClose } from 'react-icons/md';
import { TimeChip } from './TimeChip/TimeChip';
import { formatTimeOfDay, startMinutesOf } from '@/lib/schedule';
import styles from './EventCard.module.scss';

export function EventCard({ event }: { event: ScheduledEvent }) {
  const activity = useActivity(event.typeId);
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
    data: { kind: 'event', eventId: event.id },
  });

  if (!activity) return null;

  const style = {
    '--activity-color': activity.color,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  const subTypes = activity.workoutTypes ?? [];
  // A "times" activity is always one occurrence, so "1 times" is noise.
  const hasValue = activity.metric !== 'times';
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
    <div
      className={styles.card}
      style={style}
      ref={setNodeRef}
    >
      {/* The band is the drag handle, so it sits darker than the card body and
          reads as something to grab. Remove waits at the far end until the card
          is hovered, so a wall of x's never competes with the plan itself. */}
      <div className={styles.header} {...attributes} {...listeners}>
        {isDuration ? (
          // A duration activity's own value already says how long it runs, so
          // the header's time is just a label here, not a second control for
          // the same fact — dimmed to read as repeated rather than actionable.
          <span className={styles.headerTime}>{formatTimeOfDay(startMinutesOf(event))}</span>
        ) : (
          <TimeChip event={event} activity={activity} />
        )}
        <button
          className={styles.removeButton}
          // The band drags, so the button keeps its own pointer events.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            removeEvent(event.id);
          }}
          title="Remove event"
          aria-label="Remove event"
        >
          <MdClose size={14} />
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.identity}>
          {React.createElement(getIconByKey(activity.icon), { className: styles.icon })}
          <span className={styles.title}>{activity.name}</span>
          {subTypes.length > 0 && (
            <Select
              size="sm"
              hideChevron
              className={styles.subtagSelect}
              aria-label={`${activity.name} type`}
              value={event.workoutType || ''}
              onChange={(e) => setEventSubType(event.id, e.target.value)}
            >
              {/* No sub-type chosen. A dash keeps the pill quiet; the aria-label
                  carries what the control is for. */}
              <option value="">-</option>
              {subTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          )}
        </div>

        {hasValue && valueEntry}
      </div>
    </div>
  );
}
