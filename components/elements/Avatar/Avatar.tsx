'use client';
import React from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { MdPerson } from 'react-icons/md';
import styles from './Avatar.module.scss';

export interface AvatarProps {
  src?: string | null;
  /** Used for the initial fallback and as the image's alt text. */
  name?: string | null;
  size?: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 32, className }) => {
  const initial = name?.trim().charAt(0).toUpperCase();

  return (
    <span
      className={clsx(styles.avatar, className)}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {src ? (
        <Image
          className={styles.image}
          src={src}
          alt={name ?? ''}
          width={size}
          height={size}
        />
      ) : initial ? (
        initial
      ) : (
        <MdPerson size={size * 0.62} />
      )}
    </span>
  );
};
