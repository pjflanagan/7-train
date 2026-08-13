import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { isGoogleAuthConfigured } from '@/lib/auth';
import './globals.scss';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: '7 Train',
  description: 'Plan your weekly targets',
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
        <AuthProvider isGoogleAuthConfigured={isGoogleAuthConfigured}>
          {children}
          <Toaster theme="dark" />
        </AuthProvider>
      </body>
    </html>
  );
}
