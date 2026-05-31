import type { Metadata, Viewport } from 'next';
import { Inter, Outfit, DM_Sans } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
});

const themeScript = `
(() => {
  try {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const enabled = saved === 'dark' || (!saved && prefersDark);
    document.documentElement.classList.toggle('dark', enabled);
  } catch {}
})();
`;

export const metadata: Metadata = {
  title: 'InterviewPrep Live - Master Your Next Interview',
  description: 'Live 1-to-1 interview preparation with industry experts',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${inter.variable} ${outfit.variable} ${dmSans.variable} font-sans antialiased overflow-x-hidden`}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
