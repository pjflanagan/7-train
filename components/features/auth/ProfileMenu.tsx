'use client';

import React, { useState } from 'react';
import { MdLogout, MdSettings, MdSync } from 'react-icons/md';
import { FcGoogle } from 'react-icons/fc';
import { signOut } from 'next-auth/react';
import { Avatar } from '@/components/elements/Avatar/Avatar';
import { Menu, MenuItem } from '@/components/elements/Menu/Menu';
import { IntegrationsModal } from '@/components/features/auth/IntegrationsModal';
import { SettingsModal } from '@/components/features/settings/SettingsModal';
import { useGoogleAccount, useIsGoogleAuthConfigured } from '@/hooks/useAuth';
import styles from './ProfileMenu.module.scss';

type OpenModal = 'integrations' | 'settings' | null;

/** Header avatar. Opens the account dropdown, which is also the way into settings. */
export const ProfileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const isGoogleAuthConfigured = useIsGoogleAuthConfigured();
  const { name, email, image, isSignedIn, needsReauth } = useGoogleAccount();

  const open = (modal: OpenModal) => {
    setIsOpen(false);
    setOpenModal(modal);
  };

  return (
    <>
      <Menu
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        aria-label="Account"
        trigger={
          <button
            type="button"
            className={styles.trigger}
            onClick={() => setIsOpen((wasOpen) => !wasOpen)}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-label={isSignedIn ? `Account, signed in as ${name ?? email}` : 'Account'}
          >
            <Avatar src={image} name={name ?? email} size={30} />
            {needsReauth && <span className={styles.alertDot} aria-hidden="true" />}
          </button>
        }
      >
        {isGoogleAuthConfigured && (
          <MenuItem
            icon={isSignedIn ? <MdSync /> : <FcGoogle />}
            onClick={() => open('integrations')}
          >
            {isSignedIn ? 'Integrations' : 'Sign in with Google'}
          </MenuItem>
        )}
        <MenuItem icon={<MdSettings />} onClick={() => open('settings')}>
          Settings
        </MenuItem>
        {isGoogleAuthConfigured && isSignedIn && (
          <MenuItem
            icon={<MdLogout />}
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
          >
            Logout
          </MenuItem>
        )}
      </Menu>

      <IntegrationsModal
        isOpen={openModal === 'integrations'}
        onClose={() => setOpenModal(null)}
      />
      <SettingsModal isOpen={openModal === 'settings'} onClose={() => setOpenModal(null)} />
    </>
  );
};
