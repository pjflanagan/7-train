import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { isGoogleAuthConfigured } from '@/lib/auth';
import { isStravaConfigured } from '@/lib/stravaServer';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';
import './globals.scss';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#101014',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider integrations={{ isGoogleAuthConfigured, isStravaConfigured }}>
          {children}
          <Toaster theme="dark" />
        </AuthProvider>
      </body>
    </html>
  );
}
