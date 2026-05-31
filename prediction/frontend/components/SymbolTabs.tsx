import type { MarketSymbol } from '../types/market';

const SYMBOL_LABELS: Record<MarketSymbol, string> = {
  BTCUSDT: 'BTC/USDT',
  SOLUSDT: 'SOL/USDT',
};

type SymbolTabsProps = {
  selectedSymbol: MarketSymbol;
  onSelectSymbol: (symbol: MarketSymbol) => void;
};

export function SymbolTabs({ selectedSymbol, onSelectSymbol }: SymbolTabsProps) {
  return (
    <div className="symbolTabs">
      {(Object.keys(SYMBOL_LABELS) as MarketSymbol[]).map((symbol) => (
        <button
          className={symbol === selectedSymbol ? 'symbolTab active' : 'symbolTab'}
          key={symbol}
          onClick={() => onSelectSymbol(symbol)}
          type="button"
        >
          {SYMBOL_LABELS[symbol]}
        </button>
      ))}
    </div>
  );
}
