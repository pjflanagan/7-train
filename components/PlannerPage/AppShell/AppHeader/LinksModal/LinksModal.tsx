'use client';

import React from 'react';
import { MdOpenInNew } from 'react-icons/md';
import { useAllActivityLinks } from '@/hooks/usePlannerSelectors';
import { getIconByKey } from '@/lib/icons';
import { Modal } from '@/components/elements/Modal/Modal';
import styles from './LinksModal.module.scss';
import { COPY } from '@/lib/copy';

export interface LinksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Every link on every activity, in one list.
 *
 * Read-only, and deliberately so: this used to be a second set of bookmarks
 * kept beside the plan, with its own add form and its own delete — a separate
 * thing to curate that had nothing to do with the activities it sat next to,
 * and no store behind it once the browser cache went. A link is about an
 * activity, so it is written on the activity, in "My activities" or on a
 * week's target. This is the view over the lot of them.
 */
export const LinksModal: React.FC<LinksModalProps> = ({ isOpen, onClose }) => {
  const activities = useAllActivityLinks();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={COPY.links.bookmarks} maxWidth="420px">
      <div className={styles.container}>
        {activities.length === 0 ? (
          <p className={styles.empty}>{COPY.links.emptyMessage}</p>
        ) : (
          activities.map((activity) => {
            const Icon = getIconByKey(activity.icon);
            return (
              <section
                key={activity.activityId}
                className={styles.group}
                style={{ '--activity-color': activity.color } as React.CSSProperties}
              >
                <h3 className={styles.groupTitle}>
                  <Icon className={styles.groupIcon} />
                  {activity.name}
                </h3>
                <div className={styles.list}>
                  {activity.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.linkRow}
                    >
                      <span className={styles.linkInfo}>
                        <span className={styles.linkTitle}>{link.title || link.url}</span>
                        <span className={styles.linkUrl}>{link.url}</span>
                      </span>
                      <MdOpenInNew className={styles.openIcon} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </Modal>
  );
};
