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


def get_element_value(element: Any) -> str | None:
    for attribute in ["datetime", "title", "aria-label", "data-date", "data-time", "content"]:
        value = element.get(attribute)
        if value:
            return str(value).strip()

    text = element.get_text(" ", strip=True)
    return text or None


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

    return get_element_value(element)


def extract_time_from_html(html: str, selector: str | None) -> str | None:
    selected_time = extract_text_from_selector(html, selector)
    if selected_time:
        return selected_time

    soup = BeautifulSoup(html, "html.parser")
    for fallback_selector in ["time", "span.font-metadata", '[class*="time"]', '[class*="date"]', '[datetime]']:
        try:
            elements = soup.select(fallback_selector)
        except Exception:
            continue

        for element in elements:
            value = get_element_value(element)
            if parse_relative_time(value) or parse_absolute_time(value):
                return value

    text = soup.get_text(" ", strip=True)
    match = re.search(r"\b\d+\s*(?:phút|minute|minutes|min|giờ|hour|hours|hr|ngày|day|days)\b(?:\s+ago|\s+trước)?", text, re.IGNORECASE)
    return match.group(0) if match else None


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


def parse_absolute_time(raw_time: str | None) -> datetime | None:
    if not raw_time:
        return None

    normalized = raw_time.strip()
    for date_format in [
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
    ]:
        try:
            parsed_time = datetime.strptime(normalized, date_format)
            return parsed_time.replace(tzinfo=None)
        except ValueError:
            continue

    try:
        return datetime.fromisoformat(normalized.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def parse_time_to_iso(raw_time: str | None, time_format: str | None) -> tuple[str, bool]:
    parsed_time = None

    if time_format == "timestamp":
        parsed_time = parse_absolute_time(raw_time) or parse_relative_time(raw_time)
    else:
        parsed_time = parse_relative_time(raw_time) or parse_absolute_time(raw_time)

    used_fallback = parsed_time is None
    if used_fallback:
        parsed_time = datetime.utcnow()

    return parsed_time.isoformat(), used_fallback


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
            raw_time = extract_time_from_html(raw_html, config.get("time_published"))
            print("RAW TIME", raw_time)
            parsed_time, used_time_fallback = parse_time_to_iso(raw_time, config.get("time_format"))
            print(f"[crawler:step3] source={source_name} raw_time={raw_time!r} parsed_time={parsed_time}", flush=True)
            if used_time_fallback:
                print(
                    f"[crawler:step3] warning source={source_name} title={title[:80]!r} raw_time={raw_time!r} "
                    f"selector={config.get('time_published')!r} fallback_time={parsed_time}",
                    flush=True,
                )
            final_news.append(
                {
                    "type": "news",
                    "id": str(uuid.uuid4()),
                    "symbol": None,
                    "title": title,
                    "description": description,
                    "source": source_name,
                    "time": parsed_time,
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
