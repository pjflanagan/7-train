'use client';

import React from 'react';
import clsx from 'clsx';
import { signIn } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import { Avatar } from '@/components/elements/Avatar/Avatar';
import { Button } from '@/components/elements/Button/Button';
import { Modal } from '@/components/elements/Modal/Modal';
import { connectGoogleIntegration, useGoogleAccount } from '@/hooks/useAuth';
import { useCalendarSyncStatus } from '@/hooks/useCalendarSyncStatus';
import { useSheetsExport } from '@/hooks/useSheetsExport';
import {
  GOOGLE_INTEGRATIONS,
  GOOGLE_INTEGRATION_LIST,
  GoogleIntegrationId,
  isIntegrationConnected,
} from '@/lib/google';
import styles from './IntegrationsModal.module.scss';

export interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SYNC_LABEL: Record<string, string> = {
  off: '',
  pulling: 'Reading your calendar…',
  syncing: 'Sending changes…',
  synced: 'Up to date',
  error: 'Sync failed',
};

/**
 * The Google account and what it is wired up to. Connecting an integration is
 * a consent step; what each one then does lives in its own row.
 */
export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({ isOpen, onClose }) => {
  const { name, email, image, isSignedIn, isLoading, scopes, needsReauth } = useGoogleAccount();
  const { status, resync } = useCalendarSyncStatus();
  const { exportToSheets, isExporting } = useSheetsExport();

  const renderAction = (id: GoogleIntegrationId) => {
    if (id === 'calendar') {
      return (
        <div className={styles.action}>
          <span className={styles.muted}>{SYNC_LABEL[status]}</span>
          <Button variant="secondary" onClick={resync} disabled={status === 'pulling'}>
            Sync now
          </Button>
        </div>
      );
    }

    return (
      <Button variant="secondary" onClick={() => exportToSheets()} disabled={isExporting}>
        {isExporting ? 'Exporting…' : 'Export now'}
      </Button>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSignedIn ? 'Integrations' : 'Sign in'}
      maxWidth="440px"
    >
      <div className={styles.container}>
        {isLoading ? (
          <p className={styles.muted}>Checking your sign in…</p>
        ) : isSignedIn ? (
          <>
            <div className={styles.identity}>
              <Avatar src={image} name={name ?? email} size={44} />
              <div className={styles.identityText}>
                {name && <span className={styles.name}>{name}</span>}
                {email && <span className={clsx(styles.muted, styles.email)}>{email}</span>}
              </div>
            </div>

            {needsReauth && (
              <div className={styles.warning}>
                <span className={styles.muted}>
                  Google access expired. Sign in again to restore it.
                </span>
                <Button variant="secondary" onClick={() => signIn('google')}>
                  Reconnect
                </Button>
              </div>
            )}

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Google</h3>
              <p className={styles.note}>
                Your calendar holds the workouts once it is connected, so a change made in
                Google Calendar shows up here. Goals stay on this device.
              </p>

              {GOOGLE_INTEGRATION_LIST.map((integration) => (
                <div className={styles.row} key={integration.id}>
                  <div className={styles.rowText}>
                    <span className={styles.label}>{integration.label}</span>
                    <span className={styles.muted}>{integration.description}</span>
                  </div>
                  {isIntegrationConnected(scopes, integration) ? (
                    renderAction(integration.id)
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => connectGoogleIntegration(integration, scopes)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              ))}

              {isIntegrationConnected(scopes, GOOGLE_INTEGRATIONS.calendar) &&
                status === 'error' && (
                  <p className={styles.note}>
                    The last sync did not go through. Your plan is safe on this device —
                    try again, or reconnect the calendar.
                  </p>
                )}
            </div>
          </>
        ) : (
          <>
            <p className={styles.muted}>
              Sign in to sync your plan with Google Calendar and export it to Sheets. Your
              plan stays on this device either way.
            </p>
            <Button
              variant="primary"
              className={styles.signIn}
              onClick={() => signIn('google')}
            >
              <FcGoogle size={18} /> Sign in with Google
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
};
