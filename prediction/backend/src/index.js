require('dotenv').config();

const { createBinanceWebSocket } = require('./binance/binanceWebSocket');
const { initDb } = require('./db/initDb');
const { pool } = require('./db/pool');
const { upsertCandle } = require('./db/candleRepository');
const { createHttpServer } = require('./http/httpServer');
const { createNewsPredictionLoop } = require('./news/newsPredictionLoop');
const { createWebSocketServer } = require('./websocket/wsServer');

const PORT = Number(process.env.PORT || 4000);

async function start() {
  await initDb();

  const httpServer = createHttpServer();
  const wsServer = createWebSocketServer({ server: httpServer });
  const latestPrices = new Map();

  function getCurrentPrice(symbol) {
    return latestPrices.get(symbol);
  }

  const binanceWebSocket = createBinanceWebSocket({
    onMarketData: (message) => {
      if (message.type === 'ticker') {
        latestPrices.set(message.symbol, message.lastPrice);
      }

      if (message.type === 'candle') {
        latestPrices.set(message.symbol, message.close);
        upsertCandle(message).catch((error) => {
          console.error(`[postgres] failed to persist ${message.symbol} candle:`, error.message);
        });
      }

      wsServer.broadcast(message);
    },
  });
  const newsPredictionLoop = createNewsPredictionLoop({
    broadcast: wsServer.broadcast,
    getCurrentPrice,
  });

  httpServer.listen(PORT, () => {
    console.log(`[backend] started on port ${PORT}`);
    binanceWebSocket.start();
    newsPredictionLoop.start();
  });

  async function shutdown() {
    console.log('[backend] shutting down');
    binanceWebSocket.stop();
    newsPredictionLoop.stop();
    wsServer.server.close();
    httpServer.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(async (error) => {
  console.error('[backend] failed to start:', error.message);
  await pool.end();
  process.exit(1);
});
