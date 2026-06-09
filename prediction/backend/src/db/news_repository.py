import hashlib
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import psycopg2
from dotenv import load_dotenv

SRC_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = SRC_ROOT.parent
if str(SRC_ROOT) not in sys.path:
    sys.path.append(str(SRC_ROOT))

load_dotenv(BACKEND_ROOT / ".env")


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required to persist crawled news")
    return database_url


def create_stable_news_id(news: dict[str, Any]) -> str:
    title = news.get("title") or ""
    digest = hashlib.sha256(title.strip().lower().encode("utf-8")).hexdigest()[:24]
    return f"crawl_{digest}"


def normalize_news_item(news: dict[str, Any]) -> dict[str, Any] | None:
    title = (news.get("title") or "").strip()
    if not title:
        return None

    return {
        "id": create_stable_news_id(news),
        "symbol": news.get("symbol"),
        "title": title,
        "description": news.get("description"),
        "source": news.get("source") or "unknown",
        "time": news.get("time") or datetime.utcnow().isoformat(),
        "status": news.get("status") or "under_predict",
    }


def save_news_items(news_items: list[dict[str, Any]]) -> dict[str, int]:
    normalized_items = [item for item in (normalize_news_item(news) for news in news_items) if item]
    if not normalized_items:
        return {"received": len(news_items), "saved": 0, "skipped": len(news_items)}

    inserted_count = 0
    updated_count = 0

    with psycopg2.connect(get_database_url()) as connection:
        with connection.cursor() as cursor:
            for item in normalized_items:
                cursor.execute(
                    """
                    INSERT INTO news (
                      id,
                      symbol,
                      title,
                      description,
                      source,
                      time,
                      status
                    )
                    VALUES (
                      %(id)s,
                      %(symbol)s,
                      %(title)s,
                      %(description)s,
                      %(source)s,
                      %(time)s,
                      %(status)s
                    )
                    ON CONFLICT (title)
                    DO UPDATE SET
                      id = EXCLUDED.id,
                      symbol = EXCLUDED.symbol,
                      description = EXCLUDED.description,
                      source = EXCLUDED.source,
                      time = EXCLUDED.time,
                      status = EXCLUDED.status
                    RETURNING xmax = 0 AS inserted
                    """,
                    item,
                )
                inserted = cursor.fetchone()[0]
                if inserted:
                    inserted_count += 1
                else:
                    updated_count += 1

    result = {
        "received": len(news_items),
        "unique_titles": len(normalized_items),
        "inserted": inserted_count,
        "updated": updated_count,
        "saved": inserted_count + updated_count,
        "skipped": len(news_items) - len(normalized_items),
    }
    print(f"[crawler:db] news persistence result={result}", flush=True)
    return result
