import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Realtime Crypto Chart',
  description: 'Realtime BTC/USDT and SOL/USDT chart powered by Binance WebSocket data',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
