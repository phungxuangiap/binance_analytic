import ast
import json
import os
import sys
from pathlib import Path
from pprint import pformat
from typing import Any

from bs4 import BeautifulSoup
from dotenv import load_dotenv

SRC_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = SRC_ROOT.parent
if str(SRC_ROOT) not in sys.path:
    sys.path.append(str(SRC_ROOT))

load_dotenv(BACKEND_ROOT / ".env")

SOURCE_CONFIGS_PATH = SRC_ROOT / "config" / "source_configs.py"
VALID_TIME_FORMATS = {"last_x", "timestamp"}
DEFAULT_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3-32b")

AI_PROMPT_TEMPLATE = """You are a web scraping selector analyzer.

I will provide one HTML snippet of a repeated news card component.

Your job:
Return reusable CSS selectors for extracting:
- post_title
- post_description
- time_published
- time_format

Rules:
- Return only valid JSON.
- Selectors must be relative to one news card item, not the whole document.
- Prefer stable semantic selectors over long utility classes.
- If a field does not exist, set it to null.
- post_title must not be null.
- time_format must be either "last_x" or "timestamp".
- Do not include markdown.

Return exactly:
{{
  "post_title": "...",
  "post_description": "...",
  "time_published": "...",
  "time_format": "last_x",
  "source_name": "..."
}}

Input:
source_name: {source_name}
html_snippet:
{html_snippet}
"""


def load_existing_source_configs() -> list[dict[str, Any]]:
    if not SOURCE_CONFIGS_PATH.exists():
        return []

    try:
        module_ast = ast.parse(SOURCE_CONFIGS_PATH.read_text(encoding="utf-8"))
        for node in module_ast.body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == "source_configs":
                        value = ast.literal_eval(node.value)
                        return value if isinstance(value, list) else []
    except Exception as error:
        print(f"[crawler:step2] warning failed to load source_configs.py: {error}")

    return []


def write_source_configs(source_configs: list[dict[str, Any]]) -> None:
    SOURCE_CONFIGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    content = "source_configs = " + pformat(source_configs, width=120, sort_dicts=False) + "\n"
    SOURCE_CONFIGS_PATH.write_text(content, encoding="utf-8")


def is_complete_config(config: dict[str, Any]) -> bool:
    return bool(config.get("source_name")) and bool(config.get("post_title")) and config.get("time_format") in VALID_TIME_FORMATS


def extract_json_object(content: str) -> dict[str, Any]:
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("AI response did not contain JSON object")
    return json.loads(content[start : end + 1])


def normalize_selector(selector: str | None) -> str | None:
    if selector is None:
        return None
    selector = selector.strip()
    if not selector:
        return None
    if selector.startswith((".", "#", "[")) or " " in selector or ">" in selector or ":" in selector:
        return selector
    if selector.lower() in {"a", "p", "time", "span", "div", "h1", "h2", "h3", "h4", "h5", "h6"}:
        return selector
    return "." + selector


def selector_has_text(raw_html: str, selector: str | None) -> bool:
    if not selector:
        return False
    soup = BeautifulSoup(raw_html, "html.parser")
    try:
        element = soup.select_one(selector)
    except Exception:
        return False
    return bool(element and element.get_text(" ", strip=True))


def find_fallback_title_selector(raw_html: str) -> str | None:
    soup = BeautifulSoup(raw_html, "html.parser")
    for selector in ["h1", "h2", "h3", "a", '[class*="title"]']:
        if selector_has_text(raw_html, selector):
            return selector

    for tag in soup.find_all(True):
        class_names = tag.get("class", [])
        if any("title" in class_name.lower() for class_name in class_names) and tag.get_text(" ", strip=True):
            return "." + ".".join(class_names)

    return None


def validate_source_config(config: dict[str, Any], source_name: str, raw_html: str) -> dict[str, Any] | None:
    if config.get("source_name") != source_name:
        return None

    time_format = config.get("time_format")
    if time_format not in VALID_TIME_FORMATS:
        return None

    normalized_config = {
        "source_name": source_name,
        "post_title": normalize_selector(config.get("post_title")),
        "post_description": normalize_selector(config.get("post_description")),
        "time_published": normalize_selector(config.get("time_published")),
        "time_format": time_format,
    }

    if not selector_has_text(raw_html, normalized_config["post_title"]):
        fallback_title = find_fallback_title_selector(raw_html)
        if fallback_title:
            print(f"[crawler:step2] fallback title selector source={source_name} selector={fallback_title}")
            normalized_config["post_title"] = fallback_title

    if not selector_has_text(raw_html, normalized_config["post_title"]):
        print(f"[crawler:step2] warning source={source_name} generated config cannot extract title")
        return None

    return normalized_config


def analyze_html_with_heuristic(source_name: str, html_snippet: str) -> dict[str, Any] | None:
    title_selector = find_fallback_title_selector(html_snippet)
    if not title_selector:
        return None

    description_selector = None
    for selector in ["p", '[class*="description"]', '[class*="desc"]', '[class*="excerpt"]', '[class*="summary"]']:
        if selector_has_text(html_snippet, selector):
            description_selector = selector
            break

    time_selector = None
    for selector in ["time", '[class*="time"]', '[class*="date"]']:
        if selector_has_text(html_snippet, selector):
            time_selector = selector
            break

    return {
        "source_name": source_name,
        "post_title": title_selector,
        "post_description": description_selector,
        "time_published": time_selector,
        "time_format": "last_x",
    }


def analyze_html_with_ai(source_name: str, html_snippet: str) -> dict[str, Any] | None:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print(f"[crawler:step2] GROQ_API_KEY missing, using heuristic config for source={source_name}")
        return analyze_html_with_heuristic(source_name, html_snippet)

    try:
        from groq import Groq

        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": AI_PROMPT_TEMPLATE.format(source_name=source_name, html_snippet=html_snippet[:12000]),
                }
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or ""
        return extract_json_object(content)
    except Exception as error:
        print(f"[crawler:step2] AI failed source={source_name}: {error}. Falling back to heuristic.")
        return analyze_html_with_heuristic(source_name, html_snippet)


def ensure_source_configs(list_raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    source_configs = load_existing_source_configs()
    existing_by_source = {config.get("source_name"): config for config in source_configs if is_complete_config(config)}

    for raw_source in list_raw:
        source_name = raw_source.get("source_name")
        raw_htmls = raw_source.get("list_raw_htmls") or []
        existing_config = existing_by_source.get(source_name)

        if existing_config and is_complete_config(existing_config):
            print(f"[crawler:step2] config exists source={source_name}, skip AI")
            continue

        if not raw_htmls:
            print(f"[crawler:step2] warning source={source_name} no raw HTML sample, skip config generation")
            continue

        print(f"[crawler:step2] generating config source={source_name}")
        raw_html = raw_htmls[0]
        generated_config = analyze_html_with_ai(source_name, raw_html)
        if not generated_config:
            print(f"[crawler:step2] warning source={source_name} no config generated")
            continue

        validated_config = validate_source_config(generated_config, source_name, raw_html)
        if not validated_config:
            continue

        source_configs = [config for config in source_configs if config.get("source_name") != source_name]
        source_configs.append(validated_config)
        existing_by_source[source_name] = validated_config
        write_source_configs(source_configs)
        print(f"[crawler:step2] saved config source={source_name}")

    if not SOURCE_CONFIGS_PATH.exists():
        write_source_configs(source_configs)

    return source_configs


if __name__ == "__main__":
    from scripts.step1_fetch_raw_html import fetch_all_sources_raw_html

    print(json.dumps(ensure_source_configs(fetch_all_sources_raw_html()), ensure_ascii=False, indent=2))
