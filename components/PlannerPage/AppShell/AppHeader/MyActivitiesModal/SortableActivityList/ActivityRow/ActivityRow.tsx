import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Activity } from '@/lib/types';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import { ConfirmDialog } from '@/components/elements/ConfirmDialog/ConfirmDialog';
import { MdDragIndicator, MdEdit, MdDelete, MdLink } from 'react-icons/md';
import { usePlannerStore } from '@/lib/store';
import { ActivityFormModal } from '@/components/PlannerPage/ActivityFormModal/ActivityFormModal';
import { ActivityLinksPickerModal } from '@/components/PlannerPage/ActivityLinksPickerModal/ActivityLinksPickerModal';
import styles from './ActivityRow.module.scss';
import clsx from 'clsx';
import { getIconByKey } from '@/lib/icons';

export interface ActivityRowProps {
  activity: Activity;
}

export const ActivityRow: React.FC<ActivityRowProps> = ({ activity }) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  
  const deleteActivity = usePlannerStore((s) => s.deleteActivity);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: activity.id });

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
        
        <div className={styles.iconWrapper} style={{ backgroundColor: activity.color }}>
          {React.createElement(getIconByKey(activity.icon), { size: 20, color: 'var(--text-on-accent)' })}
        </div>

        <div className={styles.content}>
          <div className={styles.name}>{activity.name}</div>
          <div className={styles.target}>
            {activity.optional ? 'Optional' : `${activity.target || 0} ${activity.unit}`}
          </div>
        </div>

        <div className={styles.actions}>
          {activity.links && activity.links.length > 0 && (
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

      <ActivityFormModal 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        activity={activity} 
      />

      <ActivityLinksPickerModal
        isOpen={isLinksOpen}
        onClose={() => setIsLinksOpen(false)}
        activity={activity}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete activity"
        message={`Are you sure you want to delete ${activity.name}? This will also remove all related calendar events.`}
        isDestructive
        confirmLabel="Delete"
        onConfirm={() => {
          deleteActivity(activity.id);
          setIsDeleteOpen(false);
        }}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </>
  );
};
