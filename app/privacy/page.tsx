import type { Metadata } from 'next';
import { PrivacyPage } from '@/components/PrivacyPage/PrivacyPage';

export const metadata: Metadata = {
  title: 'Privacy policy · 7 Train',
  description: 'What 7 Train stores, and what it does not',
};

export default function Privacy() {
  return <PrivacyPage />;
}
