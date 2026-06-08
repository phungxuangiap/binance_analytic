import re
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup

SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.append(str(SRC_ROOT))


def extract_text_from_selector(html: str, selector: str | None) -> str | None:
    if not selector:
        return None

    soup = BeautifulSoup(html, "html.parser")
    try:
        element = soup.select_one(selector)
    except Exception as error:
        print(f"[crawler:step3] selector failed selector={selector}: {error}")
        return None

    if not element:
        return None

    text = element.get_text(" ", strip=True)
    return text or None


def parse_relative_time(raw_time: str | None) -> datetime | None:
    if not raw_time:
        return None

    normalized = raw_time.strip().lower()
    match = re.search(r"(\d+)", normalized)
    if not match:
        return None

    value = int(match.group(1))
    now = datetime.utcnow()

    if any(token in normalized for token in ["phút", "minute", "minutes", "min"]):
        return now - timedelta(minutes=value)
    if any(token in normalized for token in ["giờ", "hour", "hours", "hr"]):
        return now - timedelta(hours=value)
    if any(token in normalized for token in ["ngày", "day", "days"]):
        return now - timedelta(days=value)

    return None


def parse_time_to_iso(raw_time: str | None, time_format: str | None) -> str:
    parsed_time = None

    if time_format == "last_x":
        parsed_time = parse_relative_time(raw_time)
    elif raw_time:
        for date_format in [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%d/%m/%Y %H:%M",
            "%d/%m/%Y",
        ]:
            try:
                parsed_time = datetime.strptime(raw_time.strip(), date_format)
                break
            except ValueError:
                continue

    if not parsed_time:
        parsed_time = datetime.utcnow()

    return parsed_time.isoformat()


def extract_final_news(list_raw: list[dict[str, Any]], source_configs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    configs_by_source = {config.get("source_name"): config for config in source_configs}
    final_news = []
    seen_keys = set()

    for raw_source in list_raw:
        source_name = raw_source.get("source_name")
        config = configs_by_source.get(source_name)
        raw_htmls = raw_source.get("list_raw_htmls") or []

        if not config:
            print(f"[crawler:step3] warning source={source_name} missing config, skip extraction")
            continue

        extracted_count = 0
        for raw_html in raw_htmls:
            title = extract_text_from_selector(raw_html, config.get("post_title"))
            if not title:
                continue

            dedupe_key = (source_name, title.strip().lower())
            if dedupe_key in seen_keys:
                continue
            seen_keys.add(dedupe_key)

            description = extract_text_from_selector(raw_html, config.get("post_description"))
            raw_time = extract_text_from_selector(raw_html, config.get("time_published"))
            final_news.append(
                {
                    "type": "news",
                    "id": str(uuid.uuid4()),
                    "symbol": None,
                    "title": title,
                    "description": description,
                    "source": source_name,
                    "time": parse_time_to_iso(raw_time, config.get("time_format")),
                }
            )
            extracted_count += 1

        print(f"[crawler:step3] extracted source={source_name} final_news={extracted_count}")

    return final_news


if __name__ == "__main__":
    import json
    from scripts.step1_fetch_raw_html import fetch_all_sources_raw_html
    from scripts.step2_generate_source_configs import ensure_source_configs

    raw = fetch_all_sources_raw_html()
    configs = ensure_source_configs(raw)
    print(json.dumps(extract_final_news(raw, configs), ensure_ascii=False, indent=2))
