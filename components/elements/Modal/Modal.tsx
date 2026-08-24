'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { MdClose } from 'react-icons/md';
import { IconButton } from '@/components/elements/IconButton/IconButton';
import styles from './Modal.module.scss';
import { COPY } from '@/lib/copy';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Actions pinned below the body, outside the scrolling area. */
  footer?: React.ReactNode;
  className?: string;
  maxWidth?: string;
  /**
   * Whether there is a way out of it. False drops the close button and stops
   * Escape and a backdrop click from closing — for a modal that is not a layer
   * over the app but the whole of what the app is showing, where dismissing it
   * would leave nothing behind. `onClose` is then never called.
   */
  isDismissible?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
  maxWidth = '500px',
  isDismissible = true
}) => {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setTimeout(() => {
      if (active) setMounted(true);
    }, 0);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen && mounted) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (isDismissible) onClose();
          return;
        }

        if (e.key === 'Tab' && dialogRef.current) {
          const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          
          if (focusableElements.length === 0) return;

          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      
      // Auto-focus first element
      setTimeout(() => {
        if (dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          // if there's a close button and then main content, focus the first main content element or just the close button
          if (focusable.length > 0) {
            focusable[0].focus();
          }
        }
      }, 0);

      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, mounted, onClose, isDismissible]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div 
      className={styles.overlay} 
      ref={overlayRef} 
      onMouseDown={(e) => {
        if (isDismissible && e.target === overlayRef.current) onClose();
      }}
    >
      <div 
        ref={dialogRef}
        className={clsx(styles.dialog, className)} 
        style={{ maxWidth }}
        role="dialog" 
        aria-modal="true"
        tabIndex={-1}
      >
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {isDismissible && (
            <div className={styles.closeWrapper}>
              <IconButton onClick={onClose} aria-label={COPY.modal.close}>
                <MdClose />
              </IconButton>
            </div>
          )}
        </div>
        <div className={styles.content}>
          {children}
        </div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
};