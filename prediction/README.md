# Realtime Crypto Chart

Feature này triển khai dashboard realtime cho BTC/USDT và SOL/USDT. Backend Node.js kết nối Binance WebSocket public market data, normalize dữ liệu, lưu candle vào PostgreSQL, rồi phát realtime cho frontend Next.js qua WebSocket nội bộ. Frontend dùng `lightweight-charts` để vẽ candlestick chart và preload historical candles từ backend API sau khi reload.

## Kiến trúc hệ thống

```text
Binance WebSocket
    ↓
Node.js Backend Binance Client
    ↓
Normalize Market Data
    ↓
PostgreSQL candles table
    ↓
Backend HTTP API + WebSocket Server
    ↓
Next.js Frontend
    ↓
TradingView Lightweight Chart
```

## Flow dữ liệu

1. Backend mở một kết nối duy nhất tới Binance combined stream.
2. Binance gửi `kline_1m` và `ticker` cho BTC/USDT, SOL/USDT.
3. Backend parse JSON, normalize dữ liệu candle/ticker về format thống nhất.
4. Với candle, backend upsert vào PostgreSQL theo khóa `(exchange, symbol, interval, open_time)`.
5. Backend broadcast message đã normalize tới tất cả frontend clients đang connect.
6. Khi frontend load/reload, frontend gọi `GET /api/candles` để lấy candles đã lưu, sau đó tiếp tục nhận realtime từ `NEXT_PUBLIC_WS_URL`.
7. Nếu WebSocket bị disconnect, backend tự reconnect Binance và frontend tự reconnect backend.

## Cấu trúc thư mục

```text
prediction/
  backend/
    src/
      index.js
      binance/
        binanceWebSocket.js
        normalizeBinanceMessage.js
      db/
        candleRepository.js
        initDb.js
        pool.js
      http/
        httpServer.js
      websocket/
        wsServer.js
      news/
        fakeNewsGenerator.js
        newsPredictionLoop.js
      prediction/
        fakePredictor.js
      config/
        symbols.js
    package.json
    Dockerfile
    .env.example

  frontend/
    app/
      page.tsx
      layout.tsx
      globals.css
    components/
      CryptoChart.tsx
      PredictionOverlay.tsx
      NewsPanel.tsx
      PredictionPanel.tsx
      SymbolTabs.tsx
      TickerCard.tsx
      ConnectionStatus.tsx
    hooks/
      useCryptoWebSocket.ts
    utils/
      predictionGeometry.ts
    types/
      market.ts
    package.json
    Dockerfile
    .env.example

  docker-compose.yml
  README.md
```

## Cách chạy bằng Docker

Từ thư mục project root:

```bash
cd binance_prediction/prediction
docker compose up --build
```

Sau khi chạy:

- Backend HTTP API: `http://localhost:4001`
- Backend WebSocket: `ws://localhost:4001`
- Frontend: `http://localhost:3000`
- PostgreSQL: `localhost:5433` trên host, `5432` trong container

## Các port sử dụng

| Service | Port | Mục đích |
| --- | --- | --- |
| postgres | `5433` trên host, `5432` trong container | PostgreSQL lưu candles |
| backend | `4001` trên host, `4000` trong container | HTTP API và WebSocket server cho frontend |
| frontend | `3000` | Next.js trading dashboard |

## Cách kiểm tra backend WebSocket

Có thể dùng `wscat`:

```bash
npx wscat -c ws://localhost:4001
```

Nếu backend đang nhận dữ liệu Binance, bạn sẽ thấy message dạng ticker hoặc candle realtime.

## Cách kiểm tra candle API từ PostgreSQL

Sau khi backend chạy khoảng 1-2 phút để nhận candles, gọi:

```bash
curl 'http://localhost:4001/api/candles?symbol=BTCUSDT&interval=1m&limit=10'
```

API trả về danh sách candle đã lưu trong PostgreSQL, sắp xếp tăng dần theo `openTime`.

## Prediction Rectangle Overlay

Backend tạo fake news và fake prediction tương ứng, resolve conflict prediction ở backend, lưu active prediction vào PostgreSQL, rồi broadcast thay đổi qua WebSocket. Frontend chỉ render prediction state đã được backend quyết định bằng canvas overlay, không dùng marker làm visual chính.

- Chiều dài rectangle trên trục X = `predicted_time_horizon` sau khi convert sang seconds.
- Fake prediction random `predicted_time_horizon` trong range `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `4h`.
- Fake news/prediction được broadcast theo delay ngẫu nhiên giữa `FAKE_NEWS_MIN_DELAY_MS` và `FAKE_NEWS_MAX_DELAY_MS` để mô phỏng luồng news realtime.
- Prediction `SIDEWAYS` và neutral news bị ignore ở backend.
- Prediction active được lưu trong PostgreSQL và preload qua `GET /api/predictions?symbol=BTCUSDT&limit=200`.
- Khi backend update prediction cũ, WebSocket gửi lại message `type: prediction` cùng `news_id`; frontend replace item cũ.
- Khi backend xóa prediction conflict, WebSocket gửi `type: prediction_deleted` với `news_id`; frontend remove item đó.
- Rule overlap backend:
  - Ngược hướng và prediction sau mạnh hơn prediction trước ít nhất 50 điểm impact: rút ngắn prediction trước tới start time của prediction sau, giữ prediction sau.
  - Ngược hướng và prediction trước mạnh hơn prediction sau ít nhất 50 điểm impact: bỏ prediction sau.
  - Ngược hướng và impact gần nhau dưới 50 điểm: bỏ cả hai prediction.
  - Cùng hướng: bỏ prediction sau, update prediction trước với `impact_score = max(impact_score1, impact_score2)`.
- Giá bắt đầu là close price của candle gần nhất tại hoặc sau `predicted_affect_start_time`; nếu không có thì dùng candle gần nhất còn lại.
- Chiều cao rectangle = `impact_score` thang 0-100 quy đổi thành expected price move.
- BTCUSDT dùng `maxMovePercent = 0.06`, SOLUSDT dùng `maxMovePercent = 0.09`, nên expected move vẫn luôn nhỏ hơn 0.1% khi `impact_score <= 100`.
- UP vẽ rectangle phía trên start price và mũi tên chéo từ trái dưới sang phải trên.
- DOWN vẽ rectangle phía dưới start price và mũi tên chéo từ trái trên sang phải dưới.
- Đây chỉ là mô phỏng realtime news prediction, chưa phải AI prediction thật.

## Cách kiểm tra frontend

1. Mở `http://localhost:3000`.
2. Kiểm tra trạng thái connection ở góc trên phải là `Connected`.
3. Chọn tab `BTC/USDT` hoặc `SOL/USDT`.
4. Quan sát ticker và chart cập nhật realtime.
5. Reload trang và kiểm tra candles trước đó vẫn hiển thị nhờ dữ liệu từ PostgreSQL.
6. Dừng backend để kiểm tra frontend chuyển sang `Reconnecting`, sau đó chạy lại backend để kiểm tra reconnect.

## Binance streams đang sử dụng

Backend tạo combined stream từ config trong `backend/src/config/symbols.js`:

```text
wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/solusdt@kline_1m/btcusdt@ticker/solusdt@ticker
```

Streams:

- `btcusdt@kline_1m`
- `solusdt@kline_1m`
- `btcusdt@ticker`
- `solusdt@ticker`

## Cách thêm coin mới, ví dụ ETH/USDT

1. Thêm ETH vào `backend/src/config/symbols.js`:

```js
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
  {
    symbol: 'ETHUSDT',
    displayName: 'ETH/USDT',
    streamSymbol: 'ethusdt',
  },
];
```

2. Cập nhật frontend type trong `frontend/types/market.ts`:

```ts
export type MarketSymbol = 'BTCUSDT' | 'SOLUSDT' | 'ETHUSDT';
```

3. Thêm `ETHUSDT` vào danh sách symbol trong:

- `frontend/hooks/useCryptoWebSocket.ts`
- `frontend/components/SymbolTabs.tsx`
- `frontend/components/TickerCard.tsx`

4. Rebuild Docker:

```bash
docker compose up --build
```

## Reset database nếu muốn xóa candles cũ

Dừng stack và xóa volume PostgreSQL:

```bash
docker compose down -v
```

Sau đó chạy lại:

```bash
docker compose up --build
```

## Lưu ý phase hiện tại

- Đã lưu candles vào PostgreSQL từ thời điểm backend bắt đầu nhận Binance stream.
- Chưa backfill historical candles từ Binance REST API, nên lần chạy đầu tiên cần đợi backend nhận dữ liệu mới.
- Ticker vẫn chỉ realtime in-memory, chưa lưu PostgreSQL.
- Chưa có authentication.
- Backend dùng PostgreSQL cho candle persistence và in-memory broadcast cho realtime clients.

## Gợi ý nâng cấp phase sau

- Thêm Binance REST backfill để chart có nhiều historical candles ngay lần chạy đầu.
- Lưu ticker snapshot hoặc OHLCV aggregate nâng cao.
- Thêm migration tool thay vì auto `CREATE TABLE IF NOT EXISTS` khi startup.
- Thêm health check Docker phụ thuộc readiness của PostgreSQL.
- Thêm retry strategy có exponential backoff và jitter.
- Thêm multi-symbol config đồng bộ từ backend sang frontend.
- Thêm alerting, indicators, drawing tools và timeframe selector.
