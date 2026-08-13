import React from 'react';
import clsx from 'clsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarItem } from '@/lib/types';
import { useGoal } from '@/hooks/usePlannerSelectors';
import { usePlannerStore } from '@/lib/store';
import { getIconByKey } from '@/lib/icons';
import { Select } from '@/components/elements/Select/Select';
import { InlineNumberInput } from '@/components/elements/InlineNumberInput/InlineNumberInput';
import { MdClose } from 'react-icons/md';
import { TimeChip } from './TimeChip';
import styles from './ScheduledCard.module.scss';

export function ScheduledCard({ item }: { item: CalendarItem }) {
  const goal = useGoal(item.typeId);
  const updateItemValue = usePlannerStore(state => state.updateItemValue);
  const setItemSubType = usePlannerStore(state => state.setItemSubType);
  const removeItem = usePlannerStore(state => state.removeItem);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { kind: 'item', itemId: item.id },
  });

  if (!goal) return null;

  const style = {
    '--goal-color': goal.color,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  const subTypes = goal.workoutTypes ?? [];
  // A "times" goal is always one occurrence, so "1 times" is noise.
  const hasValue = goal.metric !== 'times';
  // A duration goal's value is its length, so the number entry sits where the
  // length control would be instead of repeating it a line further down.
  const isDuration = goal.metric === 'duration';

  const valueEntry = (
    <div className={clsx(styles.valueRow, isDuration && styles.valueRowTrailing)}>
      <InlineNumberInput
        value={item.value || 0}
        onCommit={(val) => updateItemValue(item.id, val)}
        className={styles.valueInput}
      />
      <span className={styles.unit}>{goal.unit}</span>
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
        {React.createElement(getIconByKey(goal.icon), { className: styles.icon })}
        <span className={styles.title}>{goal.name}</span>
        <button
          className={styles.removeButton}
          // The band drags, so the button keeps its own pointer events.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            removeItem(item.id);
          }}
          title="Remove item"
          aria-label="Remove item"
        >
          <MdClose size={14} />
        </button>
      </div>

      <div className={styles.body}>
        <TimeChip
          item={item}
          goal={goal}
          trailing={isDuration && hasValue ? valueEntry : undefined}
        />

        {subTypes.length > 0 && (
          <Select
            size="sm"
            className={styles.subtagSelect}
            aria-label={`${goal.name} type`}
            value={item.workoutType || ''}
            onChange={(e) => setItemSubType(item.id, e.target.value)}
          >
            {/* No sub-type chosen. A dash keeps the pill quiet; the aria-label
                carries what the control is for. */}
            <option value="">-</option>
            {subTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        )}

        {hasValue && !isDuration && valueEntry}
      </div>
    </div>
  );
}
