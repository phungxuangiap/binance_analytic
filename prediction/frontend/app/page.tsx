'use client';

import { useState } from 'react';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { CryptoChart } from '../components/CryptoChart';
import { NewsPanel } from '../components/NewsPanel';
import { PredictionPanel } from '../components/PredictionPanel';
import { SymbolTabs } from '../components/SymbolTabs';
import { TickerCard } from '../components/TickerCard';
import { TradingPanel } from '../components/TradingPanel';
import { useCryptoWebSocket } from '../hooks/useCryptoWebSocket';
import type { MarketSymbol } from '../types/market';

export default function Home() {
  const [selectedSymbol, setSelectedSymbol] = useState<MarketSymbol>('BTCUSDT');
  const { status, candles, tickers, news, predictions, tradingEvents } = useCryptoWebSocket();

  return (
    <main className="dashboard">
      <header className="header">
        <div>
          <p className="eyebrow">Binance Realtime Market Data</p>
          <h1>Market Data</h1>
        </div>
        <ConnectionStatus status={status} />
      </header>

      <SymbolTabs selectedSymbol={selectedSymbol} onSelectSymbol={setSelectedSymbol} />
      <TickerCard symbol={selectedSymbol} ticker={tickers[selectedSymbol]} />

      <div className="contentGrid">
        <section className="panel chartPanel">
          <div className="panelHeader">
            <div>
              <p className="label">Candlestick Chart</p>
              <h3>{selectedSymbol} · 1m</h3>
            </div>
            <span>{candles[selectedSymbol].length} candles</span>
          </div>
          <CryptoChart candles={candles[selectedSymbol]} predictions={predictions} selectedSymbol={selectedSymbol} />
        </section>

        <aside className="feedGrid">
          <NewsPanel news={news} selectedSymbol={selectedSymbol} />
          <PredictionPanel predictions={predictions} selectedSymbol={selectedSymbol} />
          <TradingPanel events={tradingEvents} selectedSymbol={selectedSymbol} />
        </aside>
      </div>
    </main>
  );
}
