import type { Metadata } from 'next';
import { Doto, Permanent_Marker } from 'next/font/google';
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

// Dot-matrix face for the day/weather strip, like a train's destination sign.
const doto = Doto({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-doto',
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
    <html lang="en" className={`${permanentMarker.variable} ${doto.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
