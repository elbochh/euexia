import type { Metadata, Viewport } from 'next';
import BottomNav from '@/components/ui/BottomNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Euexia - Your Health Quest',
  description: 'Gamified post-consultation health checklist app',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f5fbff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-game-bg font-game antialiased">
        <main className="mobile-viewer" aria-label="Euexia mobile app preview">
          <div className="mobile-viewer__screen">
            {children}
          </div>
          <BottomNav />
        </main>
      </body>
    </html>
  );
}
