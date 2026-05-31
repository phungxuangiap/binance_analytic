const DIRECTIONS = ['UP', 'DOWN', 'SIDEWAYS'];
const HORIZONS = ['1m', '3m', '5m', '15m', '30m', '1h', '4h'];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createFakePrediction(news) {
  const newsTime = new Date(news.time).getTime();
  const affectStartTime = new Date(newsTime + 60_000);

  return {
    type: 'prediction',
    news_id: news.id,
    symbol: news.symbol,
    predicted_direction: randomItem(DIRECTIONS),
    predicted_time_horizon: randomItem(HORIZONS),
    impact_score: Number((20 + Math.random() * 80).toFixed(2)),
    predicted_affect_start_time: affectStartTime.toISOString(),
  };
}

module.exports = {
  createFakePrediction,
};
