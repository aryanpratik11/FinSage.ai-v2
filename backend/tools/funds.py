"""Indian mutual funds: AMFI NAV history via the free mfapi.in API."""

import bisect
import re
from datetime import date, datetime, timedelta

from backend.tools import fmt
from backend.tools.cache import ttl_cache
from backend.tools.http import get_json

BASE = "https://api.mfapi.in/mf"


@ttl_cache(24 * 3600, maxsize=256)
async def search_funds(query: str) -> list[dict]:
    rows = await get_json(f"{BASE}/search", {"q": query})
    return [{"code": int(x["schemeCode"]), "name": x["schemeName"]} for x in rows]


def _rank(name: str, query_tokens: set[str], plan: str) -> float:
    n = name.lower()
    score = sum(1 for t in query_tokens if t in n) * 2.0
    score += 3 if plan in n else 0
    score += 2 if "growth" in n else 0
    score -= 3 if re.search(r"idcw|dividend|bonus|payout|reinvest", n) else 0
    score -= 2 if re.search(r"\b(segregated|series|fmp|interval)\b", n) else 0
    return score - len(n) / 200  # prefer the plain scheme name on ties


@ttl_cache(6 * 3600, maxsize=256)
async def fund_details(code: int) -> dict:
    body = await get_json(f"{BASE}/{code}")
    meta, rows = body.get("meta") or {}, body.get("data") or []
    if not rows:
        raise LookupError(f"No NAV history found for scheme {code}.")

    series = sorted(
        (datetime.strptime(x["date"], "%d-%m-%Y").date(), float(x["nav"])) for x in rows if fmt.num(x.get("nav"))
    )
    dates = [d for d, _ in series]
    last_date, last_nav = series[-1]

    def nav_on(target: date) -> tuple[date, float] | None:
        i = bisect.bisect_right(dates, target) - 1
        return series[i] if i >= 0 and (target - series[i][0]).days < 10 else None

    def cagr(years: int) -> float | None:
        then = nav_on(last_date - timedelta(days=round(365.25 * years)))
        if not then:
            return None
        return round(((last_nav / then[1]) ** (1 / years) - 1) * 100, 2)

    first_date, first_nav = series[0]
    span = (last_date - first_date).days / 365.25
    one_year = [[d.isoformat(), round(v, 4)] for d, v in series if d >= last_date - timedelta(days=366)]

    return {
        "kind": "fund",
        "code": code,
        "name": meta.get("scheme_name"),
        "fund_house": meta.get("fund_house"),
        "category": meta.get("scheme_category"),
        "scheme_type": meta.get("scheme_type"),
        "nav": round(last_nav, 4),
        "nav_date": last_date.isoformat(),
        "returns": {
            "1y": cagr(1),
            "3y": cagr(3),
            "5y": cagr(5),
            "inception": round(((last_nav / first_nav) ** (1 / span) - 1) * 100, 2) if span >= 1 else None,
        },
        "inception_date": first_date.isoformat(),
        "chart": fmt.downsample(one_year, 60),
        "sources": [
            {"title": "AMFI NAV history (mfapi.in)", "url": f"https://api.mfapi.in/mf/{code}", "source": "AMFI"}
        ],
    }


async def get_mutual_fund(name_or_code: str, plan: str = "direct") -> dict:
    plan = "regular" if plan.lower().startswith("reg") else "direct"
    q = name_or_code.strip()
    if q.isdigit():
        return await fund_details(int(q))

    cleaned = re.sub(
        r"\b(mutual fund|mf|returns?|nav|performance|sip|plan|growth|direct|regular|fund)\b", " ", q, flags=re.I
    )
    words = re.sub(r"[-_/\s]+", " ", cleaned).strip().split() or q.split()
    results = []
    # mfapi requires every token to match, so retry without leading filler ("put nippon small cap").
    for start in range(min(3, len(words))):
        results = await search_funds(" ".join(words[start:]))
        if results:
            break
    if not results:
        raise LookupError(f"No mutual fund found matching '{name_or_code}'.")

    tokens = {t for t in re.findall(r"[a-z0-9]+", " ".join(words).lower()) if len(t) > 1}
    ranked = sorted(results, key=lambda x: _rank(x["name"], tokens, plan), reverse=True)
    details = dict(await fund_details(ranked[0]["code"]))
    details["other_matches"] = [x["name"] for x in ranked[1:5]]
    return details


def fund_text(d: dict) -> str:
    r = d["returns"]
    lines = [
        f"{d['name']} (scheme code {d['code']}) — {d.get('fund_house') or ''}",
        f"Category: {d.get('category') or 'n/a'}",
        f"NAV: ₹{d['nav']:.2f} as of {d['nav_date']}",
        f"Returns (CAGR): 1Y {fmt.pct(r['1y'])}, 3Y {fmt.pct(r['3y'])}, 5Y {fmt.pct(r['5y'])}, "
        f"since inception ({d['inception_date']}) {fmt.pct(r['inception'])}",
        "Past returns are computed from AMFI NAVs and don't include exit loads or taxes.",
    ]
    if d.get("other_matches"):
        lines.append("Other matching schemes: " + "; ".join(d["other_matches"]))
    return "\n".join(lines)
