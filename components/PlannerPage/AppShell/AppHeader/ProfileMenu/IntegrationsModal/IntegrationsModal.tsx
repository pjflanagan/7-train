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
  useIsStravaConfigured,
} from '@/hooks/useAuth';
import { useCalendarSyncStatus } from '@/hooks/useCalendarSyncStatus';
import { useSheetsExport } from '@/hooks/useSheetsExport';
import { GOOGLE_INTEGRATIONS, isIntegrationConnected } from '@/lib/google';
import { usePlannerStore } from '@/lib/store';
import { COPY } from '@/lib/copy';
import { connectStrava, useStravaConnection } from '@/hooks/useStrava';
import { useStravaSyncStatus } from '@/hooks/useStravaStatus';
import styles from './IntegrationsModal.module.scss';

export interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
  const calendarId = usePlannerStore((state) => state.googleCalendarId);
  const calendarName = usePlannerStore((state) => state.googleCalendarName);
  const strava = useStravaConnection();
  const isStravaConfigured = useIsStravaConfigured();
  const { status: stravaStatus, resync: resyncStrava } = useStravaSyncStatus();

  // Calendar has no equivalent: it comes with signing in, so a signed in
  // account always has the scope. An account old enough to predate that is
  // handled by `needsReauth` above, which asks for the whole set again.
  const isSheetsConnected = isIntegrationConnected(scopes, GOOGLE_INTEGRATIONS.sheets);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSignedIn || isStravaConfigured ? COPY.integrations.title : COPY.integrations.signInTitle}
      maxWidth="440px"
    >
      <div className={styles.container}>
        {isLoading ? (
          <p className={styles.muted}>{COPY.integrations.checking}</p>
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
                <span className={styles.muted}>{COPY.integrations.reauth}</span>
                <Button variant="secondary" onClick={() => signInWithGoogle(scopes)}>
                  {COPY.integrations.reconnect}
                </Button>
              </div>
            )}

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{COPY.calendar.sectionTitle}</h3>

              {/* Which calendar is not a choice any more — the account has
                  one, and it is made without asking. It is still named here,
                  because someone looking for it in Google Calendar needs to
                  know what they are looking for. The name comes from Google on
                  every pull, so renaming it there renames it here. */}
              <div className={styles.row}>
                <div className={styles.rowText}>
                  <span className={styles.label}>
                    {calendarName ?? (calendarId ? COPY.calendar.unnamed : COPY.calendar.creating)}
                  </span>
                  <span className={styles.muted}>
                    {calendarId ? COPY.calendar.description : COPY.calendar.creatingHint}
                  </span>
                </div>
              </div>
              {status === 'error' && (
                <p className={styles.note}>{COPY.calendar.pullFailed}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <p className={styles.muted}>{COPY.integrations.signInBlurb}</p>
            <Button
              variant="primary"
              className={styles.signIn}
              onClick={() => signInWithGoogle()}
            >
              <FcGoogle size={18} /> {COPY.account.signIn}
            </Button>
          </>
        )}

        {/* Strava is its own grant, not a Google scope, so it sits in its own
            section and works whether or not there is a Google account here. */}
        {isStravaConfigured && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{COPY.strava.sectionTitle}</h3>
            <p className={styles.note}>{COPY.strava.blurb}</p>

            <div className={styles.row}>
              <div className={styles.rowText}>
                <span className={styles.label}>{COPY.strava.sectionTitle}</span>
                <span className={styles.muted}>
                  {strava.isConnected && strava.athleteName
                    ? strava.athleteName
                    : COPY.strava.notConnected}
                </span>
              </div>
              {strava.isConnected ? (
                <div className={styles.action}>
                  {COPY.strava.label[stravaStatus] && (
                    <span className={styles.status}>{COPY.strava.label[stravaStatus]}</span>
                  )}
                  <div className={styles.actionButtons}>
                    <Button
                      variant="secondary"
                      onClick={resyncStrava}
                      disabled={stravaStatus === 'reading'}
                    >
                      {COPY.strava.syncNow}
                    </Button>
                    <Button variant="secondary" onClick={() => strava.disconnect()}>
                      {COPY.strava.disconnect}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="secondary" onClick={connectStrava} disabled={strava.isLoading}>
                  {COPY.strava.connect}
                </Button>
              )}
            </div>
          </div>
        )}

        {isSignedIn && !isLoading && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{COPY.sheets.sectionTitle}</h3>

            <div className={styles.row}>
              <div className={styles.rowText}>
                {/* TODO: the label should be the sheet name and it should link to the sheet */}
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
                  {isExporting ? COPY.sheets.exporting : COPY.sheets.exportNow}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => connectGoogleIntegration(GOOGLE_INTEGRATIONS.sheets, scopes)}
                >
                  {COPY.integrations.connect}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
