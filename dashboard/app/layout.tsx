import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Visual AI Agent — Dashboard',
  description: 'Review your captured browser activity timeline.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
