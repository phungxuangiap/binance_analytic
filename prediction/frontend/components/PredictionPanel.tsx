import type { MarketSymbol, PredictionItem } from '../types/market';
import { impactScoreToPriceMovePercent } from '../utils/predictionGeometry';

type PredictionPanelProps = {
  predictions: PredictionItem[];
  selectedSymbol: MarketSymbol;
  highlightedNewsId?: string | null;
  onHighlightedNewsChange?: (newsId: string | null) => void;
};

export function PredictionPanel({ predictions, selectedSymbol, highlightedNewsId, onHighlightedNewsChange }: PredictionPanelProps) {
  const symbolPredictions = predictions.filter((item) => item.symbol === selectedSymbol).slice(-8).reverse();

  return (
    <section className="sidePanel">
      <div className="sidePanelHeader">Predictions</div>
      {symbolPredictions.length === 0 ? (
        <p className="emptyState">Waiting for predictions...</p>
      ) : symbolPredictions.map((prediction) => {
        const move = impactScoreToPriceMovePercent(prediction.impact_score);
        const sign = prediction.predicted_direction === 'DOWN' ? '-' : prediction.predicted_direction === 'UP' ? '+' : '±';

        const status = prediction.status || 'active';
        const editText = prediction.edit
          ? ` · edited ${prediction.edit.field}: ${prediction.edit.from} → ${prediction.edit.to}`
          : '';

        const highlightedClass = prediction.news_id === highlightedNewsId ? ' highlighted' : '';

        return (
          <article
            className={`feedItem ${prediction.predicted_direction.toLowerCase()} ${status}${highlightedClass}`}
            key={prediction.news_id}
            onMouseEnter={() => onHighlightedNewsChange?.(prediction.news_id)}
            onMouseLeave={() => onHighlightedNewsChange?.(null)}
          >
            <strong>{prediction.predicted_direction} · {prediction.predicted_time_horizon} · {status}{prediction.status !== 'deleted' && prediction.lifecycleStatus ? ` · ${prediction.lifecycleStatus}` : ''}</strong>
            <span>impact {prediction.impact_score.toFixed(6)} · {sign}{move.toFixed(2)}% · {new Date(prediction.predicted_affect_start_time).toLocaleTimeString()}{editText}</span>
            {prediction.reason ? <span>reason: {prediction.reason}</span> : null}
          </article>
        );
      })}
    </section>
  );
}
