'use client';

import React from 'react';
import clsx from 'clsx';
import { FcGoogle } from 'react-icons/fc';
import { Avatar } from '@/components/elements/Avatar/Avatar';
import { Button } from '@/components/elements/Button/Button';
import { Modal } from '@/components/elements/Modal/Modal';
import {
  connectGoogleIntegration,
  signInWithGoogle,
  useGoogleAccount,
} from '@/hooks/useAuth';
import { useCalendarSyncStatus } from '@/hooks/useCalendarSyncStatus';
import { useSheetsExport } from '@/hooks/useSheetsExport';
import { GOOGLE_INTEGRATIONS, isIntegrationConnected } from '@/lib/google';
import { connectStrava, useStravaConnection } from '@/hooks/useStrava';
import { useStravaSyncStatus } from '@/hooks/useStravaStatus';
import { CalendarPicker } from './CalendarPicker/CalendarPicker';
import styles from './IntegrationsModal.module.scss';

export interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STRAVA_LABEL: Record<string, string> = {
  off: '',
  waiting: 'Waiting for your calendar…',
  reading: 'Reading Strava…',
  synced: 'Up to date',
  error: 'Could not read Strava',
};

/**
 * The account and what it is wired up to, most load-bearing first: which
 * calendar the plan lives in, then Strava, then the spreadsheet export.
 *
 * Calendar sync has no row of its own to connect or to press. It comes with
 * signing in, and the header's own indicator both shows where sync is up to and
 * runs it on click — so all that is left to say here is which calendar.
 */
export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({ isOpen, onClose }) => {
  const { name, email, image, isSignedIn, isLoading, scopes, needsReauth } = useGoogleAccount();
  const { status } = useCalendarSyncStatus();
  const { exportToSheets, isExporting } = useSheetsExport();
  const strava = useStravaConnection();
  const { status: stravaStatus, resync: resyncStrava } = useStravaSyncStatus();

  const isCalendarConnected = isIntegrationConnected(scopes, GOOGLE_INTEGRATIONS.calendar);
  const isSheetsConnected = isIntegrationConnected(scopes, GOOGLE_INTEGRATIONS.sheets);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSignedIn || strava.isConfigured ? 'Integrations' : 'Sign in'}
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
                <Button variant="secondary" onClick={() => signInWithGoogle(scopes)}>
                  Reconnect
                </Button>
              </div>
            )}

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Google Calendar</h3>

              {isCalendarConnected ? (
                <>
                  <CalendarPicker />
                  {status === 'error' && (
                    <p className={styles.note}>
                      The last sync did not go through. Your plan is safe on this device —
                      try again from the header, or point this at the calendar again.
                    </p>
                  )}
                </>
              ) : (
                // Only reachable for an account that signed in before the
                // calendar came with it. Everyone new is already connected.
                <div className={styles.row}>
                  <div className={styles.rowText}>
                    <span className={styles.label}>Google Calendar</span>
                    <span className={styles.muted}>
                      {GOOGLE_INTEGRATIONS.calendar.description}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      connectGoogleIntegration(GOOGLE_INTEGRATIONS.calendar, scopes)
                    }
                  >
                    Connect
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <p className={styles.muted}>
              Sign in to keep your plan in Google Calendar, so it follows you between
              devices. Your plan stays on this device either way.
            </p>
            <Button
              variant="primary"
              className={styles.signIn}
              onClick={() => signInWithGoogle()}
            >
              <FcGoogle size={18} /> Sign in with Google
            </Button>
          </>
        )}

        {/* Strava is its own grant, not a Google scope, so it sits in its own
            section and works whether or not there is a Google account here. */}
        {strava.isConfigured && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Strava</h3>
            <p className={styles.note}>
              What you actually did, read after your calendar. A recording lands on the
              workout you planned for it and replaces the number with the real one;
              anything you did without planning is added to the day it happened.
            </p>

            <div className={styles.row}>
              <div className={styles.rowText}>
                <span className={styles.label}>Strava</span>
                <span className={styles.muted}>
                  {strava.isConnected && strava.athleteName
                    ? strava.athleteName
                    : 'Bring in your recorded workouts'}
                </span>
              </div>
              {strava.isConnected ? (
                <div className={styles.action}>
                  <span className={styles.muted}>{STRAVA_LABEL[stravaStatus]}</span>
                  <Button
                    variant="secondary"
                    onClick={resyncStrava}
                    disabled={stravaStatus === 'reading'}
                  >
                    Sync now
                  </Button>
                  <Button variant="secondary" onClick={() => strava.disconnect()}>
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={connectStrava} disabled={strava.isLoading}>
                  Connect
                </Button>
              )}
            </div>
          </div>
        )}

        {isSignedIn && !isLoading && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Google Sheets</h3>

            <div className={styles.row}>
              <div className={styles.rowText}>
                <span className={styles.label}>{GOOGLE_INTEGRATIONS.sheets.label}</span>
                <span className={styles.muted}>
                  {GOOGLE_INTEGRATIONS.sheets.description}
                </span>
              </div>
              {isSheetsConnected ? (
                <Button
                  variant="secondary"
                  onClick={() => exportToSheets()}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting…' : 'Export now'}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => connectGoogleIntegration(GOOGLE_INTEGRATIONS.sheets, scopes)}
                >
                  Connect
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
