'use client';

import { useState } from 'react';
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
  const [hoveredNewsId, setHoveredNewsId] = useState<string | null>(null);
  const { candles, tickers, news, predictions, tradingEvents } = useCryptoWebSocket();

  return (
    <main className="dashboard">
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
          <CryptoChart candles={candles[selectedSymbol]} predictions={predictions} selectedSymbol={selectedSymbol} highlightedNewsId={hoveredNewsId} onHoveredNewsChange={setHoveredNewsId} />
        </section>

        <aside className="feedGrid">
          <NewsPanel news={news} selectedSymbol={selectedSymbol} highlightedNewsId={hoveredNewsId} onHighlightedNewsChange={setHoveredNewsId} />
          <PredictionPanel predictions={predictions} selectedSymbol={selectedSymbol} highlightedNewsId={hoveredNewsId} onHighlightedNewsChange={setHoveredNewsId} />
          <TradingPanel events={tradingEvents} selectedSymbol={selectedSymbol} highlightedNewsId={hoveredNewsId} onHighlightedNewsChange={setHoveredNewsId} />
        </aside>
      </div>
    </main>
  );
}
