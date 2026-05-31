function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeKline(data) {
  if (!data?.k?.s || !data.k.i) {
    return null;
  }

  return {
    type: 'candle',
    exchange: 'binance',
    symbol: data.k.s,
    interval: data.k.i,
    openTime: data.k.t,
    closeTime: data.k.T,
    open: toNumber(data.k.o),
    high: toNumber(data.k.h),
    low: toNumber(data.k.l),
    close: toNumber(data.k.c),
    volume: toNumber(data.k.v),
    quoteVolume: toNumber(data.k.q),
    tradeCount: data.k.n,
    isClosed: data.k.x,
    eventTime: data.E,
  };
}

function normalizeTicker(data) {
  if (!data?.s) {
    return null;
  }

  return {
    type: 'ticker',
    exchange: 'binance',
    symbol: data.s,
    lastPrice: toNumber(data.c),
    priceChange: toNumber(data.p),
    priceChangePercent: toNumber(data.P),
    high24h: toNumber(data.h),
    low24h: toNumber(data.l),
    volume24h: toNumber(data.v),
    quoteVolume24h: toNumber(data.q),
    eventTime: data.E,
  };
}

function normalizeBinanceMessage(rawMessage) {
  if (!rawMessage?.data?.e) {
    return null;
  }

  if (rawMessage.data.e === 'kline') {
    return normalizeKline(rawMessage.data);
  }

  if (rawMessage.data.e === '24hrTicker') {
    return normalizeTicker(rawMessage.data);
  }

  return null;
}

module.exports = {
  normalizeBinanceMessage,
};
