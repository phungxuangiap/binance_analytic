import type { NewsItem, MarketSymbol } from '../types/market';

type NewsPanelProps = {
  news: NewsItem[];
  selectedSymbol: MarketSymbol;
  highlightedNewsId?: string | null;
  onHighlightedNewsChange?: (newsId: string | null) => void;
};

export function NewsPanel({ news, selectedSymbol, highlightedNewsId, onHighlightedNewsChange }: NewsPanelProps) {
  const symbolNews = news.filter((item) => item.symbol === selectedSymbol).slice(-8).reverse();

  return (
    <section className="sidePanel">
      <div className="sidePanelHeader">News</div>
      {symbolNews.length === 0 ? (
        <p className="emptyState">Waiting for news...</p>
      ) : symbolNews.map((item) => {
        const className = item.id === highlightedNewsId ? 'feedItem highlighted' : 'feedItem';

        return (
          <article
            className={className}
            key={item.id}
            onMouseEnter={() => onHighlightedNewsChange?.(item.id)}
            onMouseLeave={() => onHighlightedNewsChange?.(null)}
          >
            <strong>{item.title}</strong>
            <span>{item.source} · {new Date(item.time).toLocaleTimeString()}</span>
          </article>
        );
      })}
    </section>
  );
}
