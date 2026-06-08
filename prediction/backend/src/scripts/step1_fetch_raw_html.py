import sys
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.append(str(SRC_ROOT))

from config.news_sources import list_sources

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
}
TIMEOUT_SECONDS = 15
MAX_ITEMS_PER_SOURCE = 10


def normalize_entry_selector(entry_point: str) -> str:
    classes = [part.strip() for part in entry_point.split() if part.strip()]
    if not classes:
        return ""
    return "".join(f".{escape_css_class_name(class_name)}" for class_name in classes)


def escape_css_class_name(class_name: str) -> str:
    escaped = ""
    for char in class_name:
        if char.isalnum() or char in ["_", "-"]:
            escaped += char
        else:
            escaped += f"\\{char}"
    return escaped


def find_elements_by_entry_point(soup: BeautifulSoup, entry_point: str) -> list[Any]:
    selector = normalize_entry_selector(entry_point)
    if selector:
        try:
            elements = soup.select(selector)
            if elements:
                return elements
        except Exception as error:
            print(f"[crawler:step1] CSS selector failed entry_point={entry_point}: {error}")

    classes = [part.strip() for part in entry_point.split() if part.strip()]
    if not classes:
        return []

    return soup.find_all(lambda tag: tag.has_attr("class") and all(class_name in tag.get("class", []) for class_name in classes))


def fetch_source_raw_html(source: dict[str, Any]) -> dict[str, Any]:
    source_name = source.get("source_name")
    url = source.get("url")
    entry_point = source.get("entry_point", "")
    print(f"[crawler:step1] fetching source={source_name} url={url}")

    result = {
        "source_name": source_name,
        "url": url,
        "entry_point": entry_point,
        "list_raw_htmls": [],
    }

    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        elements = find_elements_by_entry_point(soup, entry_point)
        result["list_raw_htmls"] = [str(element) for element in elements[:MAX_ITEMS_PER_SOURCE]]
        if not result["list_raw_htmls"]:
            result["error"] = "No raw HTML cards found. Website may render news cards with JavaScript or selector may be outdated."
            print(f"[crawler:step1] warning source={source_name} no raw cards found")
        else:
            print(f"[crawler:step1] fetched source={source_name} cards={len(result['list_raw_htmls'])}")
    except Exception as error:
        result["error"] = str(error)
        print(f"[crawler:step1] error source={source_name}: {error}")

    return result


def fetch_all_sources_raw_html() -> list[dict[str, Any]]:
    return [fetch_source_raw_html(source) for source in list_sources]


if __name__ == "__main__":
    import json

    print(json.dumps(fetch_all_sources_raw_html(), ensure_ascii=False, indent=2))
