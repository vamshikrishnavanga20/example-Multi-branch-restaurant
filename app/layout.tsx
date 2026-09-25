import type { Metadata, Viewport } from 'next';
import { Outfit, Playfair_Display } from 'next/font/google';
import './globals.css';

const sansFont = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const serifFont = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

// 1. Metadata export (NO viewport property here)
export const metadata: Metadata = {
  title: 'Example Project | Executive Command Center',
  description: 'Real-time restaurant analytics, inventory taxonomy, POS ledger, and AI-powered business intelligence.',
  icons: {
    icon: '/icon.png',
  },
};

// 2. Separate Viewport export (fixes the Next.js warning)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

import { LuxuryNotificationProvider } from '@/components/ui/LuxuryNotifications';
import { ThemeProvider } from '@/lib/theme-context';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body 
        className={`
          ${sansFont.variable} 
          ${serifFont.variable} 
          font-sans 
          antialiased 
          min-h-screen
          overflow-x-hidden
        `}
      >
        <ThemeProvider>
          <LuxuryNotificationProvider>
            {children}
          </LuxuryNotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}