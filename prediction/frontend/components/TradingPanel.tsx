import type { MarketSymbol, TradingEvent } from '../types/market';

type TradingPanelProps = {
  events: TradingEvent[];
  selectedSymbol: MarketSymbol;
};

function formatSigned(value: number, fractionDigits = 2) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(fractionDigits)}`;
}

export function TradingPanel({ events, selectedSymbol }: TradingPanelProps) {
  const symbolEvents = events.filter((event) => event.symbol === selectedSymbol).slice(-12).reverse();

  return (
    <section className="sidePanel">
      <div className="sidePanelHeader">Trading Time</div>
      {symbolEvents.length === 0 ? (
        <p className="emptyState">Waiting for trading events...</p>
      ) : symbolEvents.map((event) => (
        <article className={`feedItem ${event.action.toLowerCase()}`} key={event.id}>
          <strong>{event.action} · {event.prediction_direction}</strong>
          <span>
            {event.transition} · {new Date(event.time).toLocaleTimeString()}
            {event.transition === 'mounting->mounted' && typeof event.pnl === 'number' && typeof event.pnlPercent === 'number'
              ? ` · P/L ${formatSigned(event.pnl)} (${formatSigned(event.pnlPercent, 3)}%)`
              : ''}
          </span>
          {typeof event.price === 'number' ? <span>price {event.price.toFixed(2)}</span> : null}
          <span>prediction {event.news_id}</span>
        </article>
      ))}
    </section>
  );
}
