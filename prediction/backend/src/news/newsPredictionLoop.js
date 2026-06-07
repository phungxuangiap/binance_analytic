const { createFakeNews } = require('./fakeNewsGenerator');
const { insertNews } = require('../db/newsRepository');
const { closeTrade, openTradeFromPrediction } = require('../db/tradeRepository');
const { createPrediction } = require('../prediction/fakePredictor');
const { resolvePrediction } = require('../prediction/predictionResolver');

const MIN_NEWS_DELAY_MS = Number(process.env.FAKE_NEWS_MIN_DELAY_MS || 8000);
const MAX_NEWS_DELAY_MS = Number(process.env.FAKE_NEWS_MAX_DELAY_MS || 15000);

function getNextDelayMs() {
  const minDelay = Math.max(1000, Math.min(MIN_NEWS_DELAY_MS, MAX_NEWS_DELAY_MS));
  const maxDelay = Math.max(minDelay, MAX_NEWS_DELAY_MS);

  return Math.floor(minDelay + Math.random() * (maxDelay - minDelay + 1));
}

function createNewsPredictionLoop({ broadcast, getCurrentPrice }) {
  let timer = null;
  const tradeTimers = new Map();

  function clearTradeTimers(newsId) {
    const timers = tradeTimers.get(newsId) || [];

    for (const tradeTimer of timers) {
      clearTimeout(tradeTimer);
    }

    tradeTimers.delete(newsId);
  }

  function scheduleTradeTimer(newsId, time, callback) {
    const delayMs = Math.max(0, new Date(time).getTime() - Date.now());
    const tradeTimer = setTimeout(async () => {
      const timers = tradeTimers.get(newsId) || [];
      tradeTimers.set(newsId, timers.filter((timerItem) => timerItem !== tradeTimer));
      await callback();
    }, delayMs);

    tradeTimers.set(newsId, [...(tradeTimers.get(newsId) || []), tradeTimer]);
  }

  function scheduleTrade(prediction) {
    clearTradeTimers(prediction.news_id);

    scheduleTradeTimer(prediction.news_id, prediction.predicted_affect_start_time, async () => {
      try {
        const entryPrice = getCurrentPrice(prediction.symbol);
        await openTradeFromPrediction({
          prediction,
          entryTime: new Date().toISOString(),
          entryPrice,
        });
      } catch (error) {
        console.error(`[trade] failed to open ${prediction.news_id}:`, error.message);
      }
    });

    scheduleTradeTimer(prediction.news_id, prediction.predicted_affect_end_time, async () => {
      try {
        const exitPrice = getCurrentPrice(prediction.symbol);
        const trade = await closeTrade({
          newsId: prediction.news_id,
          exitTime: new Date().toISOString(),
          exitPrice,
        });

        if (trade) {
          broadcast(trade);
        }
      } catch (error) {
        console.error(`[trade] failed to close ${prediction.news_id}:`, error.message);
      }
    });
  }

  async function publish() {
    try {
      const { news, impactType } = createFakeNews();

      if (impactType === 'neutral') {
        console.log(`[news] ignored neutral ${news.symbol} news ${news.id}`);
        scheduleNext();
        return;
      }

      const prediction = await createPrediction(news);

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

      const persistedNews = await insertNews(news);

      console.log(`[news] generated ${news.symbol} ${impactType} news ${news.id}`);
      console.log(`[prediction] resolved ${prediction.symbol} ${prediction.predicted_direction} ${prediction.predicted_time_horizon} impact=${prediction.impact_score} events=${predictionEvents.length}`);

      broadcast(persistedNews);
      for (const event of predictionEvents) {
        broadcast(event);

        if (event.type === 'prediction' && event.status !== 'deleted') {
          scheduleTrade(event);
        }
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

    for (const timers of tradeTimers.values()) {
      for (const tradeTimer of timers) {
        clearTimeout(tradeTimer);
      }
    }
    tradeTimers.clear();
  }

  return {
    start,
    stop,
  };
}

module.exports = {
  createNewsPredictionLoop,
};
