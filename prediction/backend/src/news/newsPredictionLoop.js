const { createFakeNews } = require('./fakeNewsGenerator');
const { createFakePrediction } = require('../prediction/fakePredictor');
const { resolvePrediction } = require('../prediction/predictionResolver');

const MIN_NEWS_DELAY_MS = Number(process.env.FAKE_NEWS_MIN_DELAY_MS || 8000);
const MAX_NEWS_DELAY_MS = Number(process.env.FAKE_NEWS_MAX_DELAY_MS || 15000);

function getNextDelayMs() {
  const minDelay = Math.max(1000, Math.min(MIN_NEWS_DELAY_MS, MAX_NEWS_DELAY_MS));
  const maxDelay = Math.max(minDelay, MAX_NEWS_DELAY_MS);

  return Math.floor(minDelay + Math.random() * (maxDelay - minDelay + 1));
}

function createNewsPredictionLoop({ broadcast }) {
  let timer = null;

  async function publish() {
    try {
      const { news, impactType } = createFakeNews();

      if (impactType === 'neutral') {
        console.log(`[news] ignored neutral ${news.symbol} news ${news.id}`);
        scheduleNext();
        return;
      }

      const prediction = createFakePrediction(news);

      if (prediction.predicted_direction === 'SIDEWAYS') {
        console.log(`[prediction] ignored sideways ${prediction.symbol} news ${news.id}`);
        scheduleNext();
        return;
      }

      const predictionEvents = await resolvePrediction(prediction);

      if (predictionEvents.length === 0) {
        console.log(`[prediction] ignored conflicted ${prediction.symbol} ${prediction.predicted_direction} news ${news.id}`);
        scheduleNext();
        return;
      }

      console.log(`[news] generated ${news.symbol} ${impactType} news ${news.id}`);
      console.log(`[prediction] resolved ${prediction.symbol} ${prediction.predicted_direction} ${prediction.predicted_time_horizon} impact=${prediction.impact_score} events=${predictionEvents.length}`);

      broadcast(news);
      for (const event of predictionEvents) {
        broadcast(event);
      }
      scheduleNext();
    } catch (error) {
      console.error('[prediction] failed to resolve prediction:', error.message);
      scheduleNext();
    }
  }

  function scheduleNext() {
    const nextDelayMs = getNextDelayMs();
    console.log(`[news] next fake news in ${nextDelayMs}ms`);
    timer = setTimeout(publish, nextDelayMs);
  }

  function start() {
    scheduleNext();
  }

  function stop() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    start,
    stop,
  };
}

module.exports = {
  createNewsPredictionLoop,
};
