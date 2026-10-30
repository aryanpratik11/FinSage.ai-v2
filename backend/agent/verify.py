"""Check that every ₹ amount and percentage in an answer is backed by data FinSage fetched or the user gave.

Evidence is the structured tool output (prices, ratios, NAVs, projections, headlines) plus the conversation text.
A figure counts as verified if some evidence value matches it within the rounding of how it's written
("₹8.97 lakh crore" matches 8,965,620,869,604), or within 3% when the answer marks it as approximate.
"""

import re
from dataclasses import dataclass

_UNIT = r"(lakh crores?|lakh cr|l cr|crores?|cr|lakhs?|lacs?|l|k|thousand)"
_NUM = r"[-+−–]?\d[\d,]*(?:\.\d+)?"
MONEY_RE = re.compile(rf"(?:₹|\brs\.?|\binr)\s*({_NUM})\s*{_UNIT}?(?![a-z])", re.I)
PCT_RE = re.compile(rf"({_NUM})\s*(?:%|percent\b)", re.I)
BARE_RE = re.compile(rf"({_NUM})\s*{_UNIT}?(?![a-z])", re.I)
APPROX_RE = re.compile(
    r"(~|≈|\babout|\baround|\bapprox(?:imately|\.)?|\bnearly|\broughly|\balmost|\bover|\bunder)\s*$", re.I
)

MULTIPLIER = {
    "lakh crore": 1e12,
    "lakh crores": 1e12,
    "lakh cr": 1e12,
    "l cr": 1e12,
    "crore": 1e7,
    "crores": 1e7,
    "cr": 1e7,
    "lakh": 1e5,
    "lakhs": 1e5,
    "lac": 1e5,
    "lacs": 1e5,
    "l": 1e5,
    "k": 1e3,
    "thousand": 1e3,
}
SKIP_KEYS = {"chart", "code", "id", "url"}


@dataclass(frozen=True)
class Figure:
    text: str
    value: float
    step: float  # the rounding unit implied by how it's written, e.g. "8.97 lakh crore" → 0.01e12
    approx: bool


def _parse(number: str, unit: str | None) -> tuple[float, float]:
    clean = number.replace(",", "").replace("−", "-").replace("–", "-")
    decimals = len(clean.split(".")[1]) if "." in clean else 0
    mult = MULTIPLIER.get((unit or "").lower(), 1.0)
    return abs(float(clean)) * mult, (10**-decimals) * mult


def figures(text: str) -> list[Figure]:
    """₹ amounts and percentages written in the text."""
    out = []
    for pattern in (MONEY_RE, PCT_RE):
        for m in pattern.finditer(text):
            unit = m.group(2) if pattern is MONEY_RE else None
            value, step = _parse(m.group(1), unit)
            approx = bool(APPROX_RE.search(text[max(0, m.start() - 15) : m.start()]))
            out.append(Figure(m.group(0).strip(), value, step, approx))
    return out


def _numbers_in_text(text: str, out: set[float]):
    for m in BARE_RE.finditer(text):
        try:
            value, _ = _parse(m.group(1), m.group(2))
            out.add(value)
            out.add(abs(float(m.group(1).replace(",", "").replace("−", "-").replace("–", "-"))))
        except ValueError:
            pass


def evidence_numbers(evidence: list) -> set[float]:
    """Every number in tool artifacts (recursively) and in evidence strings."""
    out: set[float] = set()

    def walk(obj):
        if isinstance(obj, bool) or obj is None:
            return
        if isinstance(obj, (int, float)):
            out.add(abs(float(obj)))
        elif isinstance(obj, str):
            _numbers_in_text(obj, out)
        elif isinstance(obj, dict):
            for k, v in obj.items():
                if k not in SKIP_KEYS:
                    walk(v)
        elif isinstance(obj, (list, tuple)):
            for v in obj:
                walk(v)

    walk(evidence)
    return out


def is_supported(fig: Figure, known: set[float]) -> bool:
    tolerance = max(fig.step / 2 + 1e-9, fig.value * 0.0005)
    if fig.approx:
        tolerance = max(tolerance, fig.value * 0.03)
    return any(abs(k - fig.value) <= tolerance for k in known)


def check(answer: str, evidence: list) -> dict:
    """{'checked': n, 'verified': k, 'unverified': [figure texts]} for the answer's ₹ and % figures."""
    found = figures(answer)
    known = evidence_numbers(evidence)
    unverified, seen = [], set()
    verified = 0
    for f in found:
        if is_supported(f, known):
            verified += 1
        elif f.text not in seen:
            seen.add(f.text)
            unverified.append(f.text)
    return {"checked": len(found), "verified": verified, "unverified": unverified}
