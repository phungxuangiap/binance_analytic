const WebSocket = require('ws');
const { BINANCE_WS_URL } = require('../config/symbols');
const { normalizeBinanceMessage } = require('./normalizeBinanceMessage');

const RECONNECT_DELAY_MS = Number(process.env.BINANCE_RECONNECT_DELAY_MS || 5000);

function createBinanceWebSocket({ onMarketData }) {
  let socket = null;
  let reconnectTimer = null;
  let stopped = false;

  function scheduleReconnect() {
    if (stopped || reconnectTimer) {
      return;
    }

    console.log(`[binance] reconnecting Binance WebSocket in ${RECONNECT_DELAY_MS}ms`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_DELAY_MS);
  }

  function connect() {
    console.log(`[binance] connecting to ${BINANCE_WS_URL}`);
    socket = new WebSocket(BINANCE_WS_URL);

    socket.on('open', () => {
      console.log('[binance] connected to Binance WebSocket');
    });

    socket.on('message', (buffer) => {
      let parsed;

      try {
        parsed = JSON.parse(buffer.toString());
      } catch (error) {
        console.error('[binance] JSON parse error:', error.message);
        return;
      }

      const normalized = normalizeBinanceMessage(parsed);

      if (!normalized) {
        console.warn('[binance] ignored unsupported or invalid message');
        return;
      }

      if (normalized.type === 'candle') {
        console.log(`[binance] received ${normalized.symbol} candle update openTime=${normalized.openTime} closed=${normalized.isClosed}`);
      }

      if (normalized.type === 'ticker') {
        console.log(`[binance] received ${normalized.symbol} ticker update lastPrice=${normalized.lastPrice}`);
      }

      onMarketData(normalized);
    });

    socket.on('close', (code, reason) => {
      console.warn(`[binance] disconnected. code=${code} reason=${reason.toString()}`);
      scheduleReconnect();
    });

    socket.on('error', (error) => {
      console.error('[binance] websocket error:', error.message);
    });
  }

  function start() {
    stopped = false;
    connect();
  }

  function stop() {
    stopped = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      socket.close();
    }
  }

  return {
    start,
    stop,
  };
}

module.exports = {
  createBinanceWebSocket,
};
