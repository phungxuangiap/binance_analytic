const { SYMBOLS } = require('../config/symbols');

const TOPICS = [
  'ETF inflow accelerates during US session',
  'Large whale transfer spotted on-chain',
  'Macro risk appetite improves after data release',
  'Funding rates cool while spot demand holds',
  'Exchange reserves move lower during the hour',
  'Derivative traders increase short-term positioning',
];

let nextSymbolIndex = 0;

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getNextSymbol() {
  const symbol = SYMBOLS[nextSymbolIndex % SYMBOLS.length].symbol;
  nextSymbolIndex += 1;
  return symbol;
}

function createFakeNews() {
  const now = new Date();
  const symbol = getNextSymbol();

  return {
    news: {
      type: 'news',
      id: `news_${now.getTime()}_${Math.random().toString(16).slice(2, 8)}`,
      symbol,
      title: `${symbol}: ${randomItem(TOPICS)}`,
      source: 'Fake Market News',
      time: now.toISOString(),
    },
    impactType: randomItem(['positive', 'negative', 'neutral']),
  };
}

module.exports = {
  createFakeNews,
};
