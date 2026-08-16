'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { FcGoogle } from 'react-icons/fc';
import { Avatar } from '@/components/elements/Avatar/Avatar';
import { Button } from '@/components/elements/Button/Button';
import { Modal } from '@/components/elements/Modal/Modal';
import { Tabs, TabConfig } from '@/components/elements/Tabs/Tabs';
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

type TabId = 'google' | 'strava';

/**
 * The account and what it is wired up to, one service per tab.
 *
 * A tab per service rather than a stack of sections, because the two have
 * nothing to do with each other: Strava is its own OAuth grant, not a Google
 * scope, and works with or without a Google account. Stacked, they read as one
 * settings list where connecting one might affect the other.
 *
 * The tab strip only appears when there is more than one tab — a deployment
 * without Strava credentials gets the Google panel on its own, since a single
 * tab is furniture rather than navigation.
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
  // handled by `needsReauth`, which asks for the whole set again.
  const isSheetsConnected = isIntegrationConnected(scopes, GOOGLE_INTEGRATIONS.sheets);

  const tabs = useMemo<TabConfig[]>(() => {
    const list: TabConfig[] = [{ id: 'google', label: COPY.integrations.tab.google }];
    if (isStravaConfigured) {
      list.push({ id: 'strava', label: COPY.integrations.tab.strava });
    }
    return list;
  }, [isStravaConfigured]);

  const [selectedTab, setSelectedTab] = useState<TabId>('google');

  // Derived rather than corrected in an effect: Strava's tab can go away, and
  // the panel below is rendered from this id, so a stale selection would show a
  // tab strip with nothing under it. Resolving it during render means there is
  // never a frame where that is true.
  const activeTab = tabs.some((tab) => tab.id === selectedTab) ? selectedTab : 'google';

  const hasTabs = tabs.length > 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={hasTabs || isSignedIn ? COPY.integrations.title : COPY.integrations.signInTitle}
      maxWidth="460px"
    >
      {hasTabs && (
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setSelectedTab(id as TabId)}
        />
      )}

      <div className={styles.panel}>
        {activeTab === 'google' &&
          (isLoading ? (
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

              {/* Which calendar is not a choice any more — the account has one,
                  and it is made without asking. It is still named here, because
                  someone looking for it in Google Calendar needs to know what
                  they are looking for. The name comes from Google on every
                  pull, so renaming it there renames it here. */}
              <section className={styles.card}>
                <h3 className={styles.cardTitle}>{COPY.calendar.sectionTitle}</h3>
                <p className={styles.cardValue}>
                  {calendarName ?? (calendarId ? COPY.calendar.unnamed : COPY.calendar.creating)}
                </p>
                <p className={styles.muted}>
                  {calendarId ? COPY.calendar.description : COPY.calendar.creatingHint}
                </p>
                {status === 'error' && (
                  <p className={styles.note}>{COPY.calendar.pullFailed}</p>
                )}
              </section>

              <section className={styles.card}>
                <h3 className={styles.cardTitle}>{COPY.sheets.sectionTitle}</h3>
                {/* TODO: the value should be the sheet name and link to the sheet */}
                <p className={styles.muted}>{GOOGLE_INTEGRATIONS.sheets.description}</p>
                <div className={styles.cardActions}>
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
              </section>
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
          ))}

        {activeTab === 'strava' && (
          <>
            <p className={styles.muted}>{COPY.strava.blurb}</p>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{COPY.strava.sectionTitle}</h3>
                {strava.isConnected && COPY.strava.label[stravaStatus] && (
                  <span className={styles.status}>{COPY.strava.label[stravaStatus]}</span>
                )}
              </div>

              <p className={styles.cardValue}>
                {strava.isConnected
                  ? (strava.athleteName ?? COPY.strava.sectionTitle)
                  : COPY.integrations.stravaNotConnected}
              </p>
              {!strava.isConnected && (
                <p className={styles.muted}>{COPY.strava.notConnected}</p>
              )}

              <div className={styles.cardActions}>
                {strava.isConnected ? (
                  <>
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
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={connectStrava}
                    disabled={strava.isLoading}
                  >
                    {COPY.strava.connect}
                  </Button>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
};
