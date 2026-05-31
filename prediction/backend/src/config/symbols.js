const SYMBOLS = [
  {
    symbol: 'BTCUSDT',
    displayName: 'BTC/USDT',
    streamSymbol: 'btcusdt',
  },
  {
    symbol: 'SOLUSDT',
    displayName: 'SOL/USDT',
    streamSymbol: 'solusdt',
  },
];

const INTERVAL = '1m';

const STREAMS = [
  ...SYMBOLS.map(({ streamSymbol }) => `${streamSymbol}@kline_${INTERVAL}`),
  ...SYMBOLS.map(({ streamSymbol }) => `${streamSymbol}@ticker`),
];

const BINANCE_WS_URL = `${process.env.BINANCE_WS_BASE_URL || 'wss://stream.binance.com:9443'}/stream?streams=${STREAMS.join('/')}`;

module.exports = {
  SYMBOLS,
  INTERVAL,
  STREAMS,
  BINANCE_WS_URL,
};
