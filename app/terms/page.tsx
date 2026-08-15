import type { Metadata } from 'next';
import { TermsPage } from '@/components/TermsPage/TermsPage';

export const metadata: Metadata = {
  title: 'Terms of service · 7 Train',
  description: 'The terms that govern your use of 7 Train',
};

export default function Terms() {
  return <TermsPage />;
}
