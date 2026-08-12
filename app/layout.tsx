import type { Metadata } from 'next';
import { Permanent_Marker } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.scss';

// Self-hosted at build time and exposed as a CSS variable so SCSS modules can
// reach it without importing anything.
const permanentMarker = Permanent_Marker({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-marker',
});

export const metadata: Metadata = {
  title: '7 Train',
  description: 'Plan your weekly workouts',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={permanentMarker.variable}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
