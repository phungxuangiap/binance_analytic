import hashlib
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_batch

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
    source = news.get("source") or "unknown"
    title = news.get("title") or ""
    digest = hashlib.sha256(f"{source}:{title.strip().lower()}".encode("utf-8")).hexdigest()[:24]
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
    }


def save_news_items(news_items: list[dict[str, Any]]) -> dict[str, int]:
    normalized_items = [item for item in (normalize_news_item(news) for news in news_items) if item]
    if not normalized_items:
        return {"received": len(news_items), "saved": 0, "skipped": len(news_items)}

    with psycopg2.connect(get_database_url()) as connection:
        with connection.cursor() as cursor:
            execute_batch(
                cursor,
                """
                INSERT INTO news (
                  id,
                  symbol,
                  title,
                  description,
                  source,
                  time
                )
                VALUES (
                  %(id)s,
                  %(symbol)s,
                  %(title)s,
                  %(description)s,
                  %(source)s,
                  %(time)s
                )
                ON CONFLICT (id)
                DO UPDATE SET
                  symbol = EXCLUDED.symbol,
                  title = EXCLUDED.title,
                  description = EXCLUDED.description,
                  source = EXCLUDED.source,
                  time = EXCLUDED.time
                """,
                normalized_items,
            )

    return {
        "received": len(news_items),
        "saved": len(normalized_items),
        "skipped": len(news_items) - len(normalized_items),
    }
