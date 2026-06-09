const { getNewestNewsByStatus, updateNewsStatus } = require('../db/newsRepository');
const { closeTrade, openTradeFromPrediction } = require('../db/tradeRepository');
const { createPrediction } = require('../prediction/predictor');
const { resolvePrediction } = require('../prediction/predictionResolver');

const NEWS_PREDICTION_INTERVAL_MS = Number(process.env.NEWS_PREDICTION_INTERVAL_MS || 10 * 60 * 1000);
const NEWS_PREDICTION_BATCH_SIZE = Number(process.env.NEWS_PREDICTION_BATCH_SIZE || 10);

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

  async function markNewsPredicted(news, symbol = null) {
    const updatedNews = await updateNewsStatus(news.id, 'predicted', symbol);
    if (updatedNews) {
      broadcast(updatedNews);
    }
    return updatedNews;
  }

  async function processNews(news) {
    console.log('[prediction] processing news', {
      newsId: news.id,
      title: news.title,
      source: news.source,
      status: news.status,
    });

    const prediction = await createPrediction(news);

    if (!prediction || prediction.predicted_direction === 'SIDEWAYS') {
      console.log('[prediction] marked news predicted without actionable signal', {
        newsId: news.id,
        direction: prediction?.predicted_direction,
      });
      await markNewsPredicted(news, prediction?.symbol);
      return;
    }

    const predictionEvents = await resolvePrediction(prediction);
    await markNewsPredicted(news, prediction.symbol);

    if (predictionEvents.length === 0) {
      console.log(`[prediction] ignored conflicted ${prediction.symbol} ${prediction.predicted_direction} news ${news.id}`);
      return;
    }

    console.log(`[prediction] resolved ${prediction.symbol} ${prediction.predicted_direction} ${prediction.predicted_time_horizon} impact=${prediction.impact_score} events=${predictionEvents.length}`);

    for (const event of predictionEvents) {
      broadcast(event);

      if (event.type === 'prediction' && event.status !== 'deleted') {
        scheduleTrade(event);
      }
    }
  }

  async function publish() {
    try {
      const newsItems = await getNewestNewsByStatus({
        status: 'under_predict',
        limit: NEWS_PREDICTION_BATCH_SIZE,
      });

      console.log(`[prediction] loaded under_predict news count=${newsItems.length}`);

      for (const news of newsItems) {
        try {
          await processNews(news);
        } catch (error) {
          console.error(`[prediction] failed to process news ${news.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[prediction] failed to load under_predict news:', error.message);
    } finally {
      scheduleNext();
    }
  }

  function scheduleNext() {
    console.log(`[prediction] next DB news prediction in ${NEWS_PREDICTION_INTERVAL_MS}ms`);
    timer = setTimeout(publish, NEWS_PREDICTION_INTERVAL_MS);
  }

  function start() {
    publish();
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
