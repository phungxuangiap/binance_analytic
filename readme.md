# Real-time Binance Crypto Prediction & Analytics Platform

## Overview

This project is a real-time cryptocurrency market prediction and analytics platform built around Binance market data. It connects to Binance public WebSocket streams, processes live ticker and candlestick data, stores market history, displays an interactive trading dashboard, generates simulated news-based prediction signals, and sends prediction events into an analytics pipeline for quality monitoring.

The project is designed to solve a practical trading-system problem: combining real-time exchange data, persistent historical candles, prediction visualization, event streaming, and analytics dashboards into one end-to-end decision-support system.

<img width="1920" height="1080" alt="INGESTION" src="https://github.com/user-attachments/assets/034643d4-b0ff-41d0-9e47-7af69ede22a7" />

## Project Goals

- Build a real-time trading dashboard for Binance crypto pairs.
- Ingest live market data directly from Binance WebSocket streams.
- Store candle history so charts can recover state after reload.
- Visualize prediction signals directly on candlestick charts.
- Resolve conflicting prediction signals on the backend before rendering.
- Stream prediction events into an analytics stack for long-term evaluation.
- Use Docker Compose to make the system easy to run locally as independent services.

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- TradingView Lightweight Charts
- WebSocket client
- CSS

### Backend

- Node.js
- JavaScript
- WebSocket server
- Binance WebSocket API
- PostgreSQL
- Docker

### Analytics Pipeline

- TypeScript
- Redpanda / Kafka-compatible event streaming
- KafkaJS
- ClickHouse
- Grafana
- Docker Compose

## High-level Architecture

```text
Binance WebSocket API
        ↓
Node.js Prediction Backend
        ↓
Normalize ticker and candle data
        ↓
PostgreSQL candle storage
        ↓
HTTP API + WebSocket broadcast
        ↓
Next.js Trading Dashboard

Prediction Backend
        ↓
News-based prediction events
        ↓
Analytics Bridge
        ↓
Redpanda topic
        ↓
ClickHouse analytics tables
        ↓
Grafana prediction-quality dashboard
```

## System Modules

The repository is split into two main modules:

```text
binance_prediction/
  prediction/   # Real-time trading dashboard, backend, WebSocket, PostgreSQL
  analytic/     # Redpanda, ClickHouse, Grafana, analytics event bridge
```

### `prediction` module

The `prediction` module contains the user-facing real-time trading application.

It includes:

- A Node.js backend that connects to Binance WebSocket streams.
- A PostgreSQL database for candle and prediction persistence.
- A WebSocket server that broadcasts market and prediction events.
- A Next.js frontend that renders live charts and prediction overlays.

### `analytic` module

The `analytic` module contains the event analytics stack.

It includes:

- A TypeScript analytics bridge that consumes backend WebSocket events.
- Redpanda as the Kafka-compatible event broker.
- ClickHouse as the high-performance analytical database.
- Grafana for visualizing prediction quality and trading-signal performance.

## Detailed Data Flow

### 1. Market data ingestion

The backend opens a Binance combined WebSocket stream for supported symbols. Current symbols include:

- `BTCUSDT`
- `SOLUSDT`

Current stream types include:

- `kline_1m`
- `ticker`

The backend receives raw Binance messages, parses them, and normalizes them into internal event types such as candle and ticker messages.

### 2. Candle persistence

When a candle event arrives, the backend stores it in PostgreSQL. Candle records are upserted by a unique market key so duplicate updates for the same candle interval update the existing row instead of creating duplicates.

This solves an important real-time charting problem: Binance may send multiple updates for the same candle before the candle closes. Upsert logic allows the system to keep the latest candle state while avoiding duplicated data.

### 3. Real-time broadcast

After normalization, the backend broadcasts events to every connected frontend client through its internal WebSocket server.

Broadcasted messages can include:

- Ticker updates
- Candle updates
- Prediction updates
- Prediction deletion events
- News or prediction-related events

This keeps every connected dashboard synchronized with the same backend state.

### 4. Frontend preload and live update

When the frontend loads, it first requests historical candles from the backend HTTP API. After the chart is initialized, it continues receiving real-time events from the backend WebSocket.

This creates a complete chart lifecycle:

1. Load existing candle history from PostgreSQL.
2. Render historical candles on the chart.
3. Connect to backend WebSocket.
4. Apply live candle and ticker updates.
5. Render prediction overlays as backend state changes.

### 5. Prediction event generation

The backend includes a simulated news and prediction loop. It generates fake news events and prediction signals to model how market-moving events could affect price direction.

Prediction fields include:

- Symbol
- Direction
- Impact score
- Predicted time horizon
- Predicted affect start time
- Start price
- Expected move

Although the current prediction source is simulated, the architecture is designed so this layer can later be replaced by a real ML model, rule-based signal engine, or external news-analysis service.

### 6. Prediction conflict resolution

Prediction conflict resolution is handled in the backend instead of the frontend.

This is important because multiple predictions can overlap in time and may point in different directions. If conflict logic lived only in the frontend, different clients could render inconsistent states. By resolving conflicts centrally, the backend becomes the single source of truth.

Current conflict rules include:

- Opposite direction and newer prediction is much stronger: shorten the older prediction and keep the newer one.
- Opposite direction and older prediction is much stronger: discard the newer prediction.
- Opposite direction and similar impact: cancel both predictions.
- Same direction: keep the older prediction and update it with the stronger impact score.
- Sideways or neutral predictions are ignored.

### 7. Chart prediction rendering

The frontend renders prediction signals as geometric overlays on the chart.

Each prediction overlay represents:

- X-axis length: prediction time horizon.
- Y-axis height: impact score converted into expected price movement.
- Position: above price for `UP`, below price for `DOWN`.
- Direction arrow: visual cue for predicted movement direction.

This makes prediction signals easier to understand visually than simple markers because users can see both expected duration and expected price impact.

### 8. Analytics event streaming

The analytics bridge connects to the prediction backend WebSocket and listens for prediction-related events. It validates events and publishes valid trade-prediction messages to Redpanda.

Redpanda provides a Kafka-compatible event-streaming layer. This separates real-time dashboard behavior from analytics processing, making the system more scalable and easier to extend.

### 9. ClickHouse analytics storage

ClickHouse stores prediction analytics in a fact table optimized for time-series and analytical queries.

Tracked analytics fields include:

- Event type
- News ID
- Symbol
- Prediction direction
- Predicted time horizon
- Impact score
- Predicted percent move
- Position side
- Entry action and exit action
- Entry time and exit time
- Entry price and exit price
- PnL and PnL percentage
- Result and status
- Actual percent movement
- Direction result
- Percent accuracy

This allows the project to evaluate prediction quality over time instead of only displaying predictions in real time.

### 10. Grafana monitoring

Grafana connects to ClickHouse and displays dashboards for prediction quality and trading-signal performance.

Possible dashboard insights include:

- Prediction count by symbol
- Accuracy by prediction direction
- Accuracy by time horizon
- PnL distribution
- Average impact score
- Actual movement compared with predicted movement
- Winning and losing prediction patterns

## Problems Solved

### Real-time market data ingestion

Crypto markets move quickly, so the platform uses Binance WebSocket streams instead of polling REST APIs. This allows the backend to receive ticker and candlestick updates with low latency.

### Consistent data normalization

Raw Binance WebSocket messages have exchange-specific formats. The backend converts them into stable internal message types so the frontend, database, and analytics pipeline can consume predictable data structures.

### Persistent market history

A pure real-time chart loses data after reload. This project stores candle data in PostgreSQL and exposes an API to preload candles, allowing the chart to recover historical context after refresh.

### Handling mutable candles

Live candlestick streams often send multiple updates for the same candle before it closes. The backend uses upsert persistence so each candle interval keeps the latest state without duplicating records.

### Frontend/backend real-time synchronization

The backend broadcasts normalized events through WebSocket so all connected clients receive the same market and prediction updates in real time.

### Prediction conflict handling

Multiple predictions can overlap, conflict, or point in opposite directions. The backend resolves these cases before sending data to the frontend, preventing inconsistent visualization and keeping business logic centralized.

### Clear prediction visualization

Instead of showing predictions as small markers, the frontend renders time-and-impact rectangles on the chart. This helps users understand when a prediction starts, how long it may last, which direction it expects, and how strong the move may be.

### Trading-signal quality analytics

Prediction events are streamed into Redpanda and stored in ClickHouse, enabling later analysis in Grafana. This solves the problem of not knowing whether prediction signals are accurate or profitable over time.

### Separation between real-time app and analytics

The trading dashboard can continue serving real-time users while analytics events are processed separately. This separation makes the architecture cleaner and closer to production event-driven systems.

### Containerized development environment

Both the prediction system and analytics system are containerized with Docker Compose, making the project easier to run locally and easier to separate into independent services.

## Important Technical Decisions

### WebSocket over REST polling

The system uses WebSocket streams because real-time market data requires low-latency updates. REST polling would introduce delay, waste requests, and make chart updates less smooth.

### PostgreSQL for operational storage

PostgreSQL is used for candle and prediction persistence because it is reliable, easy to query, and suitable for operational application state.

### ClickHouse for analytics storage

ClickHouse is used for prediction analytics because it is optimized for high-volume analytical queries, time-series data, aggregations, and dashboard workloads.

### Redpanda for event streaming

Redpanda is used as a Kafka-compatible broker to decouple event producers from analytics consumers. This makes the analytics pipeline easier to scale and extend.

### Backend-owned prediction state

Prediction conflict logic is implemented in the backend so every frontend client receives the same resolved prediction state.

### Docker Compose split by domain

The system separates the real-time prediction app and analytics stack into different Docker Compose files. This allows developers to run only the part they need during development.

## Repository Structure

```text
binance_prediction/
  prediction/
    backend/
      src/
        binance/       # Binance WebSocket client and message normalization
        db/            # PostgreSQL connection, initialization, repositories
        http/          # HTTP API server
        websocket/     # Internal WebSocket broadcast server
        news/          # Simulated news and prediction generation
        prediction/    # Prediction logic
        config/        # Supported symbols and runtime config
    frontend/
      app/             # Next.js app routes and layout
      components/      # Dashboard UI components
      hooks/           # WebSocket client hooks
      types/           # Market and prediction TypeScript types
      utils/           # Prediction geometry helpers
    docker-compose.yml

  analytic/
    backend/
      consumers/       # WebSocket-to-Redpanda bridge
      producer/        # Kafka/Redpanda producer
      schemas/         # Event validation schema
    clickhouse/init/   # ClickHouse database and table initialization
    grafana/           # Grafana dashboards and provisioning
    redpanda/scripts/  # Topic creation and sample event scripts
    docker-compose.yml
```

## How to Run

The project has two main stacks:

- `prediction`: real-time backend, frontend, and PostgreSQL
- `analytic`: Redpanda, ClickHouse, Grafana, and the analytics bridge

### Prerequisites

- Docker
- Docker Compose
- Internet connection for Binance public WebSocket access

### 1. Run the prediction stack

From the project root:

```bash
cd prediction
docker compose up --build
```

Services:

| Service | URL / Port | Purpose |
| --- | --- | --- |
| Frontend | `http://localhost:3003` | Trading dashboard |
| Backend HTTP API | `http://localhost:4001` | Candle and prediction APIs |
| Backend WebSocket | `ws://localhost:4001` | Real-time market and prediction events |
| PostgreSQL | `localhost:5433` | Candle and prediction persistence |

### 2. Run the analytics stack

In another terminal, from the project root:

```bash
cd analytic
docker compose up --build
```

Services:

| Service | URL / Port | Purpose |
| --- | --- | --- |
| Redpanda | `localhost:19092` | Kafka-compatible event broker |
| ClickHouse HTTP | `http://localhost:8123` | Analytics database HTTP interface |
| ClickHouse Native | `localhost:9000` | Native ClickHouse connection |
| Grafana | `http://localhost:3000` | Analytics dashboard |

Default Grafana credentials:

```text
Username: admin
Password: admin
```

## How to Test

### Check frontend behavior

1. Open `http://localhost:3003`.
2. Confirm the connection status shows connected.
3. Switch between `BTC/USDT` and `SOL/USDT`.
4. Verify live ticker and candlestick updates.
5. Wait for simulated prediction overlays to appear.
6. Reload the page and confirm historical candles are still displayed.
7. Stop and restart the backend to verify reconnect behavior.

### Check backend candle API

After the backend has run for a few minutes:

```bash
curl 'http://localhost:4001/api/candles?symbol=BTCUSDT&interval=1m&limit=10'
```

The API should return stored candle data sorted by open time.

### Check WebSocket stream

```bash
npx wscat -c ws://localhost:4001
```

You should see real-time ticker, candle, and prediction-related messages.

### Check analytics pipeline

1. Start the `prediction` stack.
2. Start the `analytic` stack.
3. Wait for prediction events to be generated.
4. Open Grafana at `http://localhost:3000`.
5. Check the provisioned prediction-quality dashboard.

## Current Limitations

- Prediction logic currently uses simulated news and fake prediction signals, not a trained machine-learning model.
- Historical candle backfill from Binance REST API is not implemented yet.
- Ticker snapshots are handled in memory and are not persisted in PostgreSQL.
- Authentication is not implemented.
- The frontend symbol list is manually configured instead of being fully driven by backend configuration.
- Current supported symbols are limited to `BTCUSDT` and `SOLUSDT`.

## Possible Future Improvements

- Add Binance REST API backfill for historical candles.
- Replace fake prediction logic with a real ML or rule-based prediction model.
- Add more symbols and configurable trading pairs.
- Add multiple chart timeframes.
- Store ticker snapshots or aggregated market metrics.
- Add alerting for high-impact prediction events.
- Add authentication and user-specific watchlists.
- Add production-grade retry strategy with exponential backoff and jitter.
- Add formal database migrations.
- Add CI/CD and automated tests.
- Add model evaluation reports from ClickHouse analytics.
- Add a strategy backtesting module.
- Add live trading integration in paper-trading mode.

## Portfolio Highlights

- Built an end-to-end real-time trading data system from exchange ingestion to frontend visualization.
- Implemented WebSocket-based streaming architecture for low-latency market updates.
- Designed PostgreSQL persistence for mutable candle data using upsert behavior.
- Created an interactive charting UI with real-time candlesticks and prediction overlays.
- Centralized prediction conflict resolution in the backend to keep client state consistent.
- Added a Kafka-compatible analytics pipeline using Redpanda and ClickHouse.
- Built Grafana-based monitoring for prediction quality and trading-signal performance.
- Containerized the full stack with Docker Compose for reproducible local deployment.

## CV Summary

Built a real-time Binance crypto prediction and analytics platform using Next.js, Node.js, WebSocket, PostgreSQL, Redpanda, ClickHouse, Grafana, and Docker. The system ingests live Binance market data, persists historical candles, visualizes prediction signals on interactive trading charts, resolves conflicting prediction events, and streams trade-prediction data into an analytics pipeline for monitoring signal quality and trading performance.
