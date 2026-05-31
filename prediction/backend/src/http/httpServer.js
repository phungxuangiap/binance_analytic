const http = require('http');
const { getCandles } = require('../db/candleRepository');
const { getNews } = require('../db/newsRepository');
const { getActivePredictions } = require('../db/predictionRepository');
const { getTrades } = require('../db/tradeRepository');
const { INTERVAL, SYMBOLS } = require('../config/symbols');

const ALLOWED_SYMBOLS = new Set(SYMBOLS.map(({ symbol }) => symbol));

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
}

function parseLimit(value) {
  const limit = Number(value || 300);

  if (!Number.isInteger(limit)) {
    return 300;
  }

  return Math.min(Math.max(limit, 1), 1000);
}

function createHttpServer() {
  return http.createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      writeJson(response, 204, {});
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      writeJson(response, 200, { status: 'ok' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/candles') {
      const symbol = url.searchParams.get('symbol');
      const interval = url.searchParams.get('interval') || INTERVAL;
      const limit = parseLimit(url.searchParams.get('limit'));

      if (!symbol || !ALLOWED_SYMBOLS.has(symbol)) {
        writeJson(response, 400, { error: 'Invalid symbol' });
        return;
      }

      if (interval !== INTERVAL) {
        writeJson(response, 400, { error: 'Invalid interval' });
        return;
      }

      try {
        const candles = await getCandles({ symbol, interval, limit });
        writeJson(response, 200, candles);
      } catch (error) {
        console.error('[http] failed to load candles:', error.message);
        writeJson(response, 500, { error: 'Failed to load candles' });
      }
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/predictions') {
      const symbol = url.searchParams.get('symbol');
      const limit = parseLimit(url.searchParams.get('limit'));

      if (!symbol || !ALLOWED_SYMBOLS.has(symbol)) {
        writeJson(response, 400, { error: 'Invalid symbol' });
        return;
      }

      try {
        const predictions = await getActivePredictions({ symbol, limit });
        writeJson(response, 200, predictions);
      } catch (error) {
        console.error('[http] failed to load predictions:', error.message);
        writeJson(response, 500, { error: 'Failed to load predictions' });
      }
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/news') {
      const symbol = url.searchParams.get('symbol');
      const limit = parseLimit(url.searchParams.get('limit'));

      if (!symbol || !ALLOWED_SYMBOLS.has(symbol)) {
        writeJson(response, 400, { error: 'Invalid symbol' });
        return;
      }

      try {
        const news = await getNews({ symbol, limit });
        writeJson(response, 200, news);
      } catch (error) {
        console.error('[http] failed to load news:', error.message);
        writeJson(response, 500, { error: 'Failed to load news' });
      }
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/trades') {
      const symbol = url.searchParams.get('symbol');
      const limit = parseLimit(url.searchParams.get('limit'));

      if (!symbol || !ALLOWED_SYMBOLS.has(symbol)) {
        writeJson(response, 400, { error: 'Invalid symbol' });
        return;
      }

      try {
        const trades = await getTrades({ symbol, limit });
        writeJson(response, 200, trades);
      } catch (error) {
        console.error('[http] failed to load trades:', error.message);
        writeJson(response, 500, { error: 'Failed to load trades' });
      }
      return;
    }

    writeJson(response, 404, { error: 'Not found' });
  });
}

module.exports = {
  createHttpServer,
};
