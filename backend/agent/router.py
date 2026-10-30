"""Rule-based tool planning for "guided" mode — used with small local models that can't call tools reliably."""

import re
import uuid

from backend.tools import calc, market, symbols

FUND_RE = re.compile(
    r"\b(mutual funds?|mf|nav|flexi ?cap|small ?cap|mid ?cap|large ?cap|multi ?cap|large & mid ?cap|index funds?|"
    r"elss|debt funds?|liquid funds?|hybrid funds?|funds?|scheme)\b",
    re.I,
)
FUND_CATEGORY_RE = re.compile(
    r"\b(flexi ?cap|small ?cap|mid ?cap|large ?cap|multi ?cap|index|elss|tax saver|liquid|debt|hybrid|"
    r"balanced advantage|nifty 50|nifty next 50|value|focused|contra|dividend yield)\b",
    re.I,
)
FUND_GENERIC = set(
    """
mutual fund funds mf nav returns return performance sip sips plan direct regular growth scheme schemes option
cagr history doing done perform performed rating review vs compare should i invest is it a good the best top
for in of my me how has what about tell show which are any safe better than year years month monthly
put invest investing start buy keep park money want add worth now right time
""".split()
)
MONTHLY_RE = re.compile(r"\b(month|monthly|per month|a month|every month|p\.?m\.?|sip|sips)\b|/\s*(month|m)\b", re.I)
GOAL_RE = re.compile(
    r"\b(how much|need to (?:invest|save)|to reach|to get|to have|to build|to accumulate|corpus|goal|target|become)\b",
    re.I,
)
LUMPSUM_RE = re.compile(r"\b(lump ?sum|one[- ]time|at once|in one go)\b", re.I)
FOLLOW_UP_RE = re.compile(
    r"\b(it|its|it's|they|them|their|this stock|that stock|this company|that company|this one|what about|how about)\b",
    re.I,
)
TAX_RE = re.compile(
    r"\b(tax|taxed|taxes|taxation|ltcg|stcg|capital gains?|80c|80d|80ccd|tds|indexation|tax regime|slab|"
    r"tax[- ]saving|tax[- ]harvest\w*|itr|advance tax)\b",
    re.I,
)
NEWSY_RE = re.compile(
    r"\b(market|markets|rbi|repo|inflation|economy|gold|silver|crude|rupee|dollar|fii|fiis|dii|ipo|ipos|budget|gdp|"
    r"fed|rally|crash|fall|falling|news|latest|today|this week|outlook|tariff|tariffs)\b",
    re.I,
)


def _call(name: str, **args) -> dict:
    return {"name": name, "args": args, "id": f"call_{uuid.uuid4().hex[:10]}", "type": "tool_call"}


def _calculator_calls(q: str) -> list[dict]:
    amounts, years = calc.parse_amounts(q), calc.parse_years(q)
    rate = calc.parse_rate(q) or 12.0
    monthly = bool(MONTHLY_RE.search(q))
    if not amounts:
        return []
    if LUMPSUM_RE.search(q) and not monthly:
        return [
            _call(
                "investment_projection", mode="lumpsum", amount=max(amounts), years=years or 10, annual_return_pct=rate
            )
        ]
    if (
        years
        and GOAL_RE.search(q)
        and max(amounts) >= 1e5
        and not (monthly and len(amounts) == 1 and max(amounts) < 1e6)
    ):
        return [_call("required_monthly_sip", target_amount=max(amounts), years=years, annual_return_pct=rate)]
    if monthly:
        return [
            _call("investment_projection", mode="sip", amount=min(amounts), years=years or 15, annual_return_pct=rate)
        ]
    if years or LUMPSUM_RE.search(q):
        return [
            _call(
                "investment_projection", mode="lumpsum", amount=max(amounts), years=years or 10, annual_return_pct=rate
            )
        ]
    return []


def _fund_query(q: str) -> str | None:
    """The fund name in the question, or None if it's a generic question like 'best large cap funds'."""
    text = re.sub(r"[₹\d,.%]+", " ", q.lower())
    categories = " ".join(m.group(0) for m in FUND_CATEGORY_RE.finditer(text))
    words = [
        w
        for w in re.findall(r"[a-z&]+", FUND_CATEGORY_RE.sub(" ", text))
        if w not in FUND_GENERIC and w not in symbols.STOP
    ]
    if not words:
        return None
    return " ".join(words + [categories]).strip()


def plan(query: str, previous_user_messages: list[str] | None = None) -> list[dict]:
    q = query.strip()
    calls = _calculator_calls(q)

    if TAX_RE.search(q):
        return [*calls, _call("get_tax_rules", topic=q)]

    if FUND_RE.search(q) and not re.search(r"\b(stock|stocks|share|shares)\b", q, re.I):
        name = _fund_query(q)
        if name:
            plan_type = "regular" if re.search(r"\bregular\b", q, re.I) else "direct"
            calls.append(_call("get_mutual_fund", name_or_code=name, plan=plan_type))
        return calls

    companies = symbols.extract_companies(q)
    if not companies and previous_user_messages and FOLLOW_UP_RE.search(q) and len(q.split()) <= 14:
        companies = symbols.extract_companies(previous_user_messages[-1])

    sector = None if companies else market.detect_sector(q)
    if len(companies) == 1:
        listing = symbols.lookup(companies[0])
        tool = "get_stock_snapshot" if listing.is_index else "get_stock_report"
        calls.append(_call(tool, name_or_symbol=companies[0]))
        calls.append(_call("search_news", query=q if listing.is_index else symbols.display_name(listing)))
    elif companies:
        calls.append(_call("compare_stocks", names_or_symbols=companies))
        calls.append(_call("search_news", query=q))
    elif sector:
        calls.append(_call("list_sector_stocks", sector=sector))
        calls.append(_call("search_news", query=q))
    elif not calls and NEWSY_RE.search(q):
        if re.search(r"\b(market|markets|today|rally|crash)\b", q, re.I):
            calls.append(_call("get_stock_snapshot", name_or_symbol="NIFTY 50"))
        calls.append(_call("search_news", query=q))
    return calls
