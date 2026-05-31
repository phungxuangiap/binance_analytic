import type { MarketSymbol, TickerMessage } from '../types/market';

const SYMBOL_LABELS: Record<MarketSymbol, string> = {
  BTCUSDT: 'BTC/USDT',
  SOLUSDT: 'SOL/USDT',
};

type TickerCardProps = {
  symbol: MarketSymbol;
  ticker?: TickerMessage;
};

function formatNumber(value?: number, maximumFractionDigits = 2) {
  if (value === undefined || value === null) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

export function TickerCard({ symbol, ticker }: TickerCardProps) {
  const change = ticker?.priceChangePercent ?? 0;
  const isPositive = change >= 0;

  return (
    <section className="tickerCard">
      <div>
        <p className="label">Symbol</p>
        <h2>{SYMBOL_LABELS[symbol]}</h2>
      </div>
      <div>
        <p className="label">Last Price</p>
        <strong>${formatNumber(ticker?.lastPrice, 4)}</strong>
      </div>
      <div>
        <p className="label">24h Change</p>
        <strong className={isPositive ? 'positive' : 'negative'}>{formatNumber(change, 2)}%</strong>
      </div>
      <div>
        <p className="label">24h High</p>
        <strong>${formatNumber(ticker?.high24h, 4)}</strong>
      </div>
      <div>
        <p className="label">24h Low</p>
        <strong>${formatNumber(ticker?.low24h, 4)}</strong>
      </div>
      <div>
        <p className="label">24h Volume</p>
        <strong>{formatNumber(ticker?.volume24h, 2)}</strong>
      </div>
    </section>
  );
}
