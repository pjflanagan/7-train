'use client';

import React from 'react';
import { FcGoogle } from 'react-icons/fc';
import { SevenLogo } from '@/components/elements/SevenLogo/SevenLogo';
import { Modal } from '@/components/elements/Modal/Modal';
import { Button } from '@/components/elements/Button/Button';
import { signInWithGoogle, useIsGoogleAuthConfigured } from '@/hooks/useAuth';
import styles from './SignInModal.module.scss';
import { COPY } from '@/lib/copy';

/**
 * The whole of the app when nobody is signed in.
 *
 * There is no plan to show. The browser caches nothing, so a signed out planner
 * would be an empty week that quietly forgets every edit on reload — worse than
 * a locked door, because it looks like it is working. See `_docs/storage.md`.
 *
 * So the door is locked, and this is the door: no header, no week behind it,
 * and no way to dismiss it. The legal pages are their own routes and are
 * reachable without signing in.
 */
export function SignInModal() {
  const isGoogleAuthConfigured = useIsGoogleAuthConfigured();

  return (
    <Modal
      isOpen
      isDismissible={false}
      onClose={() => {}}
      maxWidth="380px"
      className={styles.dialog}
    >
      <div className={styles.body}>
        <SevenLogo size={48} title={COPY.nav.logoTitle} />
        <h1 className={styles.title}>{COPY.signIn.title}</h1>
        <p className={styles.blurb}>
          {isGoogleAuthConfigured ? COPY.signIn.blurb : COPY.signIn.notConfiguredMessage}
        </p>

        {isGoogleAuthConfigured && (
          <Button
            variant="primary"
            className={styles.button}
            onClick={() => signInWithGoogle()}
          >
            <FcGoogle size={18} aria-hidden="true" />
            {COPY.account.signIn}
          </Button>
        )}

        <p className={styles.legal}>
          <a href="/terms">{COPY.account.terms}</a>
          <span aria-hidden="true">·</span>
          <a href="/privacy">{COPY.account.privacy}</a>
        </p>
      </div>
    </Modal>
  );
}
