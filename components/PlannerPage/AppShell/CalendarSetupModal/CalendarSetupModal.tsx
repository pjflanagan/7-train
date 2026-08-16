'use client';

import React, { useState } from 'react';
import { usePlannerStore } from '@/lib/store';
import { useGoogleAccount } from '@/hooks/useAuth';
import { useCalendarChoice } from '@/hooks/useCalendarChoice';
import { usePlannerHydrated } from '@/hooks/usePlannerHydrated';
import { useUserSettled } from '@/hooks/useUserSync';
import { GOOGLE_INTEGRATIONS, isIntegrationConnected } from '@/lib/google';
import { Modal } from '@/components/elements/Modal/Modal';
import { Button } from '@/components/elements/Button/Button';
import { TextInput } from '@/components/elements/TextInput/TextInput';
import styles from './CalendarSetupModal.module.scss';

/**
 * Asked once, when the calendar is connected but this browser does not know
 * which calendar to use.
 *
 * The alternative was for sync to make one whenever the id was missing, which
 * is how signing in on a second browser produced a second `Workouts` calendar
 * containing the seeded sample week. Which calendar the plan lives in is not a
 * thing to guess at.
 *
 * It can be dismissed — an unskippable modal on a page that works perfectly
 * well without Google would be a worse trade — and the same choice is waiting
 * in the integrations modal afterwards. Nothing syncs until it is answered.
 */
export const CalendarSetupModal: React.FC = () => {
  const { scopes, isSignedIn } = useGoogleAccount();
  const isHydrated = usePlannerHydrated();
  const isUserSettled = useUserSettled();
  const calendarId = usePlannerStore((state) => state.googleCalendarId);
  const { adoptExisting, createNew, isWorking, error, setError } = useCalendarChoice();

  const [value, setValue] = useState('');
  const [isDismissed, setIsDismissed] = useState(false);

  const isConnected =
    isHydrated && isSignedIn && isIntegrationConnected(scopes, GOOGLE_INTEGRATIONS.calendar);
  // The server may already know which calendar this account uses — that is what
  // the settings table is for — so asking before the pull lands would put the
  // question to someone who has already answered it, on another device.
  const needsChoice = isConnected && isUserSettled && !calendarId && !isDismissed;

  if (!needsChoice) return null;

  return (
    <Modal
      isOpen
      onClose={() => setIsDismissed(true)}
      title="Where should your workouts go?"
      maxWidth="440px"
    >
      <div className={styles.container}>
        <p className={styles.note}>
          Signing in puts your plan in Google Calendar, so it follows you between
          devices. Just say which calendar — a new one, unless you have used 7 Train
          somewhere else already.
        </p>

        {/* A fresh sign in wants a new calendar, so that is the primary path.
            Making one whenever the id was missing is what produced a second
            `Workouts` calendar per browser, so it is still a press, not a
            default — see this file's own note. */}
        <div className={styles.option}>
          <h3 className={styles.optionTitle}>Start a new calendar</h3>
          <p className={styles.help}>
            Makes a &quot;Workouts&quot; calendar in Google and puts what is on this
            browser into it.
          </p>
          <Button variant="primary" onClick={createNew} disabled={isWorking}>
            {isWorking ? 'Working…' : 'Make a new calendar'}
          </Button>
        </div>

        <div className={styles.option}>
          <h3 className={styles.optionTitle}>Use a calendar I already have</h3>
          <p className={styles.help}>
            In Google Calendar, open that calendar&apos;s settings and copy the calendar ID
            under &quot;Integrate calendar&quot;. What is in the calendar becomes your plan
            on this browser.
          </p>
          <TextInput
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            placeholder="abc123@group.calendar.google.com"
            aria-label="Calendar ID"
            error={error ?? undefined}
          />
          <Button variant="secondary" onClick={() => adoptExisting(value)} disabled={isWorking}>
            {isWorking ? 'Checking…' : 'Use this calendar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
