import type { Metadata } from 'next';
import { Inter, Outfit, DM_Sans } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'InterviewPrep Live - Master Your Next Interview',
  description: 'Live 1-to-1 interview preparation with industry experts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${outfit.variable} ${dmSans.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}