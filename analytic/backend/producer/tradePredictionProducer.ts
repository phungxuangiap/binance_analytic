import { Kafka, Producer } from 'kafkajs';
import { getTradePredictionEventKey, TradePredictionEvent } from '../schemas/tradePredictionEvent.schema.js';

type TradePredictionProducerOptions = {
  brokers: string[];
  topic: string;
  clientId?: string;
};

export type TradePredictionProducer = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  produce(event: TradePredictionEvent): Promise<void>;
};

export function createTradePredictionProducer(options: TradePredictionProducerOptions): TradePredictionProducer {
  const kafka = new Kafka({
    clientId: options.clientId || 'binance-prediction-analytics-producer',
    brokers: options.brokers,
  });
  const producer: Producer = kafka.producer({ allowAutoTopicCreation: false });

  return {
    connect() {
      return producer.connect();
    },
    disconnect() {
      return producer.disconnect();
    },
    async produce(event) {
      await producer.send({
        topic: options.topic,
        messages: [
          {
            key: getTradePredictionEventKey(event),
            value: JSON.stringify(event),
          },
        ],
      });
    },
  };
}
