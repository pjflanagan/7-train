import React from 'react';
import Link from 'next/link';
import { MdArrowBack } from 'react-icons/md';
import styles from './LegalPage.module.scss';

export interface LegalPageProps {
  title: string;
  /** Human-readable date, e.g. "15 August 2026". */
  lastUpdated: string;
  children: React.ReactNode;
}

/**
 * The shell both legal documents share: a way back to the planner, a title,
 * and prose styling for whatever headings and lists the document brings.
 */
export const LegalPage: React.FC<LegalPageProps> = ({ title, lastUpdated, children }) => (
  <main className={styles.page}>
    <Link href="/" className={styles.back}>
      <MdArrowBack aria-hidden="true" />
      Back to planner
    </Link>
    <h1 className={styles.title}>{title}</h1>
    <p className={styles.updated}>Last updated {lastUpdated}</p>
    <div className={styles.prose}>{children}</div>
  </main>
);
