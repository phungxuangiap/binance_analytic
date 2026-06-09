import type { MarketSymbol, TradeItem } from '../types/market';

type TradingPanelProps = {
  events: TradeItem[];
  selectedSymbol: MarketSymbol;
  highlightedNewsId?: string | null;
  onHighlightedNewsChange?: (newsId: string | null) => void;
};

function formatSigned(value: number, fractionDigits = 2) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(fractionDigits)}`;
}

function formatPrice(value?: number) {
  return typeof value === 'number' ? value.toFixed(2) : '--';
}

function getBuyTime(trade: TradeItem) {
  return trade.position_side === 'LONG' ? trade.entry_time : trade.exit_time;
}

function getSellTime(trade: TradeItem) {
  return trade.position_side === 'LONG' ? trade.exit_time : trade.entry_time;
}

function getBuyPrice(trade: TradeItem) {
  return trade.position_side === 'LONG' ? trade.entry_price : trade.exit_price;
}

function getSellPrice(trade: TradeItem) {
  return trade.position_side === 'LONG' ? trade.exit_price : trade.entry_price;
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleTimeString() : 'waiting...';
}

export function TradingPanel({ events, selectedSymbol, highlightedNewsId, onHighlightedNewsChange }: TradingPanelProps) {
  const symbolTrades = events.filter((event) => event.symbol === selectedSymbol).slice(-12).reverse();

  return (
    <section className="sidePanel">
      <div className="sidePanelHeader">Trading Time</div>
      {symbolTrades.length === 0 ? (
        <p className="emptyState">Waiting for trading records...</p>
      ) : symbolTrades.map((trade) => {
        const highlightedClass = trade.news_id === highlightedNewsId ? ' highlighted' : '';

        return (
          <article
            className={`feedItem ${trade.position_side.toLowerCase()}${highlightedClass}`}
            key={trade.news_id}
            onMouseEnter={() => onHighlightedNewsChange?.(trade.news_id)}
            onMouseLeave={() => onHighlightedNewsChange?.(null)}
          >
            <strong>{trade.position_side} · {trade.status}</strong>
            <span>horizon {trade.predicted_time_horizon} · predicted {trade.predicted_percent.toFixed(4)}%</span>
            <span>buy {formatTime(getBuyTime(trade))} · {formatPrice(getBuyPrice(trade))}</span>
            <span>sell {formatTime(getSellTime(trade))} · {formatPrice(getSellPrice(trade))}</span>
            {trade.status === 'closed' && typeof trade.pnl === 'number' && typeof trade.pnl_percent === 'number' ? (
              <span>
                {trade.result} · P/L {formatSigned(trade.pnl)} USDT ({formatSigned(trade.pnl_percent, 3)}%)
              </span>
            ) : (
              <span>waiting exit...</span>
            )}
            <span>prediction {trade.news_id}</span>
          </article>
        );
      })}
    </section>
  );
}
