import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

export const metadata: Metadata = {
  title: 'Snow Riu DAO Voting',
  description: 'Experimental governance tool for Snow Riu DAO',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <Header />
        <main style={{ minHeight: 'calc(100vh - 160px)' }}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
