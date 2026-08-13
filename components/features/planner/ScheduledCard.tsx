import React from 'react';
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

  return (
    <div
      className={styles.card}
      style={style}
      ref={setNodeRef}
    >
      {/* The band is the drag handle, so it sits darker than the card body and
          reads as something to grab. The icon doubles as the remove button:
          hovering it swaps the glyph for an x, so the band carries nothing but
          the workout's name. */}
      <div className={styles.header} {...attributes} {...listeners}>
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
          {React.createElement(getIconByKey(goal.icon), { className: styles.icon })}
          <MdClose size={16} className={styles.removeIcon} />
        </button>
        <span className={styles.title}>{goal.name}</span>
      </div>

      <div className={styles.body}>
        <TimeChip item={item} goal={goal} />

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

        {hasValue && (
          <div className={styles.valueRow}>
            <InlineNumberInput
              value={item.value || 0}
              onCommit={(val) => updateItemValue(item.id, val)}
              className={styles.valueInput}
            />
            <span className={styles.unit}>{goal.unit}</span>
          </div>
        )}
      </div>
    </div>
  );
}
