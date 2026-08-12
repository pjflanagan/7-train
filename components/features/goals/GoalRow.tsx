import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WorkoutType } from '@/lib/types';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import { ConfirmDialog } from '@/components/elements/ConfirmDialog/ConfirmDialog';
import { MdDragIndicator, MdEdit, MdDelete, MdLink } from 'react-icons/md';
import { usePlannerStore } from '@/lib/store';
import { GoalFormModal } from './GoalFormModal';
import { GoalLinksPickerModal } from './GoalLinksPickerModal';
import styles from './GoalRow.module.scss';
import clsx from 'clsx';
import { getIconByKey } from '@/lib/icons';

export interface GoalRowProps {
  goal: WorkoutType;
}

export const GoalRow: React.FC<GoalRowProps> = ({ goal }) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  
  const deleteGoal = usePlannerStore((s) => s.deleteGoal);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      <div 
        ref={setNodeRef} 
        style={style} 
        className={clsx(styles.row, isDragging && styles.dragging)}
      >
        <div className={styles.dragHandle} {...attributes} {...listeners}>
          <MdDragIndicator />
        </div>
        
        <div className={styles.iconWrapper} style={{ backgroundColor: goal.color }}>
          {React.createElement(getIconByKey(goal.icon), { size: 20, color: "#fff" })}
        </div>

        <div className={styles.content}>
          <div className={styles.name}>{goal.name}</div>
          <div className={styles.target}>
            Target: {goal.target || 0} {goal.unit}
          </div>
        </div>

        <div className={styles.actions}>
          {goal.links && goal.links.length > 0 && (
            <IconButton onClick={() => setIsLinksOpen(true)} title="Links">
              <MdLink />
            </IconButton>
          )}
          <IconButton onClick={() => setIsEditOpen(true)} title="Edit">
            <MdEdit />
          </IconButton>
          <IconButton onClick={() => setIsDeleteOpen(true)} variant="danger" title="Delete">
            <MdDelete />
          </IconButton>
        </div>
      </div>

      <GoalFormModal 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        goal={goal} 
      />

      <GoalLinksPickerModal
        isOpen={isLinksOpen}
        onClose={() => setIsLinksOpen(false)}
        goal={goal}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete Goal"
        message={`Are you sure you want to delete ${goal.name}? This will also remove all related calendar items.`}
        isDestructive
        confirmLabel="Delete"
        onConfirm={() => {
          deleteGoal(goal.id);
          setIsDeleteOpen(false);
        }}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </>
  );
};
