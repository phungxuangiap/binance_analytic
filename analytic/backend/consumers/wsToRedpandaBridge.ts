import WebSocket from 'ws';
import { createTradePredictionProducer } from '../producer/tradePredictionProducer.js';
import { validateTradePredictionEvent } from '../schemas/tradePredictionEvent.schema.js';

const RECONNECT_DELAY_MS = Number(process.env.RECONNECT_DELAY_MS || 3000);
const TRADE_WS_URL = process.env.TRADE_WS_URL || 'ws://host.docker.internal:4001';
const REDPANDA_BROKERS = (process.env.REDPANDA_BROKERS || 'redpanda:9092').split(',').map((broker) => broker.trim()).filter(Boolean);
const TRADE_PREDICTION_TOPIC = process.env.TRADE_PREDICTION_TOPIC || 'trade_prediction_events';

const producer = createTradePredictionProducer({
  brokers: REDPANDA_BROKERS,
  topic: TRADE_PREDICTION_TOPIC,
});

let socket: WebSocket | null = null;
let stopped = false;

function scheduleReconnect() {
  if (!stopped) {
    setTimeout(connectWebSocket, RECONNECT_DELAY_MS);
  }
}

function connectWebSocket() {
  console.log(`[analytics-bridge] connecting websocket ${TRADE_WS_URL}`);
  socket = new WebSocket(TRADE_WS_URL);

  socket.on('open', () => {
    console.log('[analytics-bridge] websocket connected');
  });

  socket.on('message', (raw) => {
    void handleMessage(raw).catch((error) => {
      console.error('[analytics-bridge] failed to handle websocket message:', error.message);
    });
  });

  socket.on('close', () => {
    console.warn('[analytics-bridge] websocket closed');
    socket = null;
    scheduleReconnect();
  });

  socket.on('error', (error) => {
    console.error('[analytics-bridge] websocket error:', error.message);
    socket?.close();
  });
}

async function handleMessage(raw: WebSocket.RawData) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw.toString());
  } catch {
    return;
  }

  const event = validateTradePredictionEvent(parsed);

  if (!event) {
    return;
  }

  await producer.produce(event);
  console.log(`[analytics-bridge] produced trade event ${event.symbol}:${event.news_id}`);
}

async function start() {
  console.log(`[analytics-bridge] redpanda brokers=${REDPANDA_BROKERS.join(',')} topic=${TRADE_PREDICTION_TOPIC}`);
  await producer.connect();
  connectWebSocket();
}

async function shutdown() {
  stopped = true;
  socket?.close();
  await producer.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

start().catch((error) => {
  console.error('[analytics-bridge] failed to start:', error.message);
  process.exit(1);
});
