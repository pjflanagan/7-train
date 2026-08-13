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

  return (
    <div 
      className={styles.card} 
      style={style}
      ref={setNodeRef}
    >
      <div className={styles.headerRow}>
        <div className={styles.header} {...attributes} {...listeners}>
          {React.createElement(getIconByKey(goal.icon), { className: styles.icon })}
          <span className={styles.title}>{goal.name}</span>
        </div>
        <button 
          className={styles.removeButton} 
          onClick={() => removeItem(item.id)}
          title="Remove item"
          aria-label="Remove item"
        >
          <MdClose size={16} />
        </button>
      </div>
      
      <TimeChip item={item} goal={goal} />

      {goal.workoutTypes && goal.workoutTypes.length > 0 && (
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
          {goal.workoutTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
      )}

      {/* A "times" goal is always one occurrence, so "1 times" is noise. */}
      {goal.metric !== 'times' && (
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
  );
}