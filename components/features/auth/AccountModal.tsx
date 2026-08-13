'use client';

import React from 'react';
import clsx from 'clsx';
import { signIn, signOut } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import { Avatar } from '@/components/elements/Avatar/Avatar';
import { Badge } from '@/components/elements/Badge/Badge';
import { Button } from '@/components/elements/Button/Button';
import { Modal } from '@/components/elements/Modal/Modal';
import { connectGoogleIntegration, useGoogleAccount } from '@/hooks/useAuth';
import { GOOGLE_INTEGRATION_LIST, isIntegrationConnected } from '@/lib/google';
import styles from './AccountModal.module.scss';

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Signing in, signing out, and the Google integrations the account has granted.
 * Granting access and using it are separate steps — nothing syncs yet, the
 * scopes are the groundwork.
 */
export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const { name, email, image, isSignedIn, isLoading, scopes, needsReauth } = useGoogleAccount();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSignedIn ? 'Account' : 'Sign in'}
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
              <h3 className={styles.sectionTitle}>Google integrations</h3>
              <p className={styles.note}>
                Connecting grants access now so syncing can be turned on later. Nothing is
                written to your Google account yet.
              </p>

              {GOOGLE_INTEGRATION_LIST.map((integration) => (
                <div className={styles.row} key={integration.id}>
                  <div className={styles.rowText}>
                    <span className={styles.label}>{integration.label}</span>
                    <span className={styles.muted}>{integration.description}</span>
                  </div>
                  {isIntegrationConnected(scopes, integration) ? (
                    <Badge variant="success">Connected</Badge>
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
            </div>

            <div className={styles.footer}>
              <Button variant="secondary" onClick={() => signOut()}>
                Sign out
              </Button>
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
