import os
import sys
import time
from datetime import datetime
from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.append(str(SRC_ROOT))

from db.news_repository import save_news_items
from news.news_crawler import crawl_news

DEFAULT_INTERVAL_SECONDS = 15 * 60


def get_crawl_interval_seconds() -> int:
    raw_interval = os.getenv("CRAWL_INTERVAL_SECONDS")
    if not raw_interval:
        return DEFAULT_INTERVAL_SECONDS

    try:
        interval = int(raw_interval)
    except ValueError:
        return DEFAULT_INTERVAL_SECONDS

    return max(10, interval)


def run_once() -> dict[str, int]:
    started_at = datetime.utcnow().isoformat()
    print(f"[crawler:scheduler] crawl started at={started_at}", flush=True)

    final_news = crawl_news()
    print(f"[crawler:scheduler] crawl extracted final_news={len(final_news)}", flush=True)

    result = save_news_items(final_news)
    print(f"[crawler:scheduler] persisted result={result}", flush=True)
    return result


def run_forever() -> None:
    interval_seconds = get_crawl_interval_seconds()
    print(f"[crawler:scheduler] starting interval_seconds={interval_seconds}", flush=True)

    while True:
        try:
            run_once()
        except Exception as error:
            print(f"[crawler:scheduler] run failed: {error}", flush=True)

        print(f"[crawler:scheduler] sleeping seconds={interval_seconds}", flush=True)
        time.sleep(interval_seconds)


if __name__ == "__main__":
    if os.getenv("CRAWL_RUN_ONCE") == "1":
        run_once()
    else:
        run_forever()
