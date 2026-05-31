import type { NewsItem, MarketSymbol } from '../types/market';

type NewsPanelProps = {
  news: NewsItem[];
  selectedSymbol: MarketSymbol;
};

export function NewsPanel({ news, selectedSymbol }: NewsPanelProps) {
  const symbolNews = news.filter((item) => item.symbol === selectedSymbol).slice(-8).reverse();

  return (
    <section className="sidePanel">
      <div className="sidePanelHeader">News</div>
      {symbolNews.length === 0 ? (
        <p className="emptyState">Waiting for fake news...</p>
      ) : symbolNews.map((item) => (
        <article className="feedItem" key={item.id}>
          <strong>{item.title}</strong>
          <span>{item.source} · {new Date(item.time).toLocaleTimeString()}</span>
        </article>
      ))}
    </section>
  );
}
