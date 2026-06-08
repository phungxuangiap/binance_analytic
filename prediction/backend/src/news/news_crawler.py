import json
import sys
from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.append(str(SRC_ROOT))

from scripts.step1_fetch_raw_html import fetch_all_sources_raw_html
from scripts.step2_generate_source_configs import ensure_source_configs
from scripts.step3_extract_final_news import extract_final_news


def crawl_news() -> list[dict]:
    # Step 1: fetch repeated raw HTML news cards from configured sources.
    list_raw = fetch_all_sources_raw_html()

    # Step 2: generate missing selector configs once, then reuse saved configs.
    source_configs = ensure_source_configs(list_raw)

    # Step 3: extract normalized final news entities from raw cards.
    final_news = extract_final_news(list_raw, source_configs)
    return final_news


if __name__ == "__main__":
    news = crawl_news()
    print(json.dumps(news, ensure_ascii=False, indent=2))
