import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OMI-TED — Translation Engine & Dubbing',
  description: 'Telugu → English transcript translation and dubbing platform for Ophir Ministries',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
