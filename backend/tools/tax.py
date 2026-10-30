"""Indian tax rules for investors, from a dated, reviewed knowledge file (data/india_tax.md).

The model would otherwise quote tax rates from memory, which go stale every Budget. Sections are matched by
keywords; edit the markdown file (and its `reviewed` date) when the rules change.
"""

import re
from functools import lru_cache
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "india_tax.md"
SOURCE = {
    "title": "Income Tax Department of India",
    "url": "https://www.incometax.gov.in",
    "source": "incometax.gov.in",
}
# "tax" and "india" appear in almost every question, so they don't help pick a section.
STOP = set(
    "a an the and or of in on for to is are how what which when do does i my me much will be it at "
    "tax taxed taxes india indian".split()
)


@lru_cache(maxsize=1)
def _load() -> tuple[dict, list[dict]]:
    text = DATA_FILE.read_text(encoding="utf-8")
    front, body = text.split("---", 2)[1:]
    meta = dict(line.split(": ", 1) for line in front.strip().splitlines())
    sections = []
    for block in re.split(r"^## ", body, flags=re.M)[1:]:
        title, rest = block.split("\n", 1)
        keywords_line, _, content = rest.partition("\n")
        keywords = keywords_line.removeprefix("keywords:").split()
        sections.append({"title": title.strip(), "keywords": keywords, "text": content.strip()})
    return meta, sections


def _words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9&]+", text.lower()) if w not in STOP]


def search(query: str, limit: int = 2) -> list[dict]:
    _, sections = _load()
    words = _words(query)
    scored = []
    for s in sections:
        keys = set(s["keywords"])
        title = s["title"].lower()
        score = sum(3 for w in words if w in keys) + sum(1 for w in words if w in title)
        # Multi-word keywords like "new regime" or "equity mutual funds".
        joined = " ".join(words)
        score += sum(2 for k in s["keywords"] if "-" in k and k.replace("-", " ") in joined)
        if score:
            scored.append((score, s))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [s for _, s in scored[:limit]]


def get_tax_rules(topic: str) -> dict:
    meta, sections = _load()
    found = search(topic) or [s for s in sections if s["title"].startswith("Income-tax regimes")]
    return {
        "kind": "tax",
        "topic": topic,
        "as_of": meta.get("as_of"),
        "reviewed": meta.get("reviewed"),
        "caveat": meta.get("caveat"),
        "sections": [{"title": s["title"], "text": s["text"]} for s in found],
        "sources": [SOURCE],
    }


def tax_text(d: dict) -> str:
    parts = [f"Indian tax rules — {d['as_of']} (reviewed {d['reviewed']}). {d['caveat']}"]
    for s in d["sections"]:
        parts.append(f"## {s['title']}\n{s['text']}")
    return "\n\n".join(parts)
