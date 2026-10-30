"""Stock report: financial trend, valuation vs its own history and peers, and a rule-based scorecard.

The scorecard is a transparent screen, not a recommendation. Every threshold lives in this file so the reasoning
behind each rating can be read and changed.
"""

import asyncio
import logging
import statistics
from datetime import timedelta

import pandas as pd
import yfinance as yf

from backend.tools import fmt, market
from backend.tools.cache import ttl_cache

log = logging.getLogger(__name__)

FINANCIALS_CACHE_SECONDS = 12 * 3600
REVENUE_ROWS = ("Total Revenue", "Operating Revenue")
PROFIT_ROWS = ("Net Income", "Net Income Common Stockholders")


# ── Financial history ─────────────────────────────────────────────────────────


def _row(df: pd.DataFrame, names) -> pd.Series | None:
    for name in names:
        if df is not None and not df.empty and name in df.index:
            return df.loc[name]
    return None


def _periods(df: pd.DataFrame) -> list[dict]:
    """Revenue / net income per period, oldest first, skipping periods without both."""
    revenue, profit = _row(df, REVENUE_ROWS), _row(df, PROFIT_ROWS)
    if revenue is None or profit is None:
        return []
    out = []
    for date in sorted(df.columns):
        r, p = fmt.num(revenue.get(date)), fmt.num(profit.get(date))
        if r is None or p is None or r <= 0:
            continue
        out.append({"end": date.date(), "revenue": r, "net_income": p, "net_margin_pct": round(p / r * 100, 2)})
    return out


def _cagr(first: float, last: float, years: float) -> float | None:
    if years <= 0 or first <= 0 or last <= 0:
        return None
    return round(((last / first) ** (1 / years) - 1) * 100, 2)


def _growth(new: float, old: float) -> float | None:
    return round((new / old - 1) * 100, 2) if old and old > 0 else None


def _match(periods: list[dict], target, tolerance_days: int = 40) -> dict | None:
    for p in periods:
        if abs((p["end"] - target).days) <= tolerance_days:
            return p
    return None


def compute_financials(annual: pd.DataFrame, quarterly: pd.DataFrame, weekly_close: pd.Series, shares: float | None):
    """Growth, margin trend and P/E history from yfinance statements and split-adjusted weekly prices.

    Historical P/E = (adjusted price at fiscal year end × current share count) / that year's net profit. Using
    adjusted prices and today's share count keeps bonus issues and splits consistent, which raw EPS history isn't.
    """
    years = _periods(annual)
    quarters = _periods(quarterly)[-5:]
    result: dict = {"annual": [], "quarters": []}

    for y in years:
        result["annual"].append(
            {
                "fy": f"FY{str(y['end'].year + (1 if y['end'].month > 3 else 0))[-2:]}",
                "revenue": y["revenue"],
                "net_income": y["net_income"],
                "net_margin_pct": y["net_margin_pct"],
            }
        )
    if len(years) >= 3:
        span = round((years[-1]["end"] - years[0]["end"]).days / 365.25)
        result["revenue_cagr_pct"] = _cagr(years[0]["revenue"], years[-1]["revenue"], span)
        result["profit_cagr_pct"] = _cagr(years[0]["net_income"], years[-1]["net_income"], span)
        result["cagr_years"] = span
        earlier = [y["net_margin_pct"] for y in years[:-1]]
        result["margin_change_pp"] = round(years[-1]["net_margin_pct"] - statistics.mean(earlier), 2)

    for q in quarters:
        result["quarters"].append(
            {
                "quarter": q["end"].strftime("%b %Y"),
                "revenue": q["revenue"],
                "net_income": q["net_income"],
                "net_margin_pct": q["net_margin_pct"],
            }
        )
    if quarters:
        latest = quarters[-1]
        year_ago = _match(quarters[:-1], latest["end"] - timedelta(days=365))
        if year_ago:
            result["latest_quarter"] = latest["end"].strftime("%b %Y")
            result["quarter_revenue_yoy_pct"] = _growth(latest["revenue"], year_ago["revenue"])
            result["quarter_profit_yoy_pct"] = _growth(latest["net_income"], year_ago["net_income"])

    if shares and weekly_close is not None and not weekly_close.empty:
        history = []
        for y in years:
            prices = weekly_close[weekly_close.index.date <= y["end"] + timedelta(days=7)]
            if prices.empty or y["net_income"] <= 0:
                continue
            pe = float(prices.iloc[-1]) * shares / y["net_income"]
            if 0 < pe < 300:
                history.append(round(pe, 1))
        if len(history) >= 3:
            result["pe_history"] = history
            result["pe_median_history"] = round(statistics.median(history), 1)
    return result


def _fetch_financials_sync(ticker: str, shares: float | None) -> dict:
    tk = yf.Ticker(ticker)
    try:
        annual, quarterly = tk.income_stmt, tk.quarterly_income_stmt
        weekly = tk.history(period="5y", interval="1wk", auto_adjust=False)["Close"].dropna()
    except Exception as e:
        log.warning("Financials failed for %s: %s", ticker, e)
        return {"annual": [], "quarters": []}
    return compute_financials(annual, quarterly, weekly, shares)


@ttl_cache(FINANCIALS_CACHE_SECONDS, maxsize=128)
async def _financials_cached(ticker: str, shares: float | None) -> dict:
    return await asyncio.to_thread(_fetch_financials_sync, ticker, shares)


# ── Peers ─────────────────────────────────────────────────────────────────────


SECTOR_NAMES = {"it": "IT", "fmcg": "FMCG", "nbfc": "NBFC"}


def sector_name(sector: str) -> str:
    return SECTOR_NAMES.get(sector, sector.title())


def sector_of(symbol: str) -> str | None:
    return next((name for name, members in market.SECTORS.items() if symbol in members), None)


async def peer_stats(symbol: str) -> dict | None:
    sector = sector_of(symbol)
    if not sector:
        return None
    peers = [s for s in market.sector_symbols(sector) if s != symbol]
    results = await asyncio.gather(*(market._snapshot_cached(p) for p in peers), return_exceptions=True)
    rows = [r for r in results if isinstance(r, dict)]
    if not rows:
        return None

    def median(key, positive=False):
        vals = [r[key] for r in rows if r.get(key) is not None and (not positive or r[key] > 0)]
        return round(statistics.median(vals), 2) if vals else None

    return {
        "sector": sector,
        "symbols": [r["symbol"] for r in rows],
        "pe_median": median("pe", positive=True),
        "pb_median": median("pb", positive=True),
        "roe_median_pct": median("roe_pct"),
        "return_1y_median_pct": median("return_1y_pct"),
    }


# ── Scorecard ─────────────────────────────────────────────────────────────────

LABELS = {
    "valuation": ("Attractive", "Fair", "Expensive"),
    "growth": ("Strong", "Moderate", "Weak"),
    "quality": ("High", "Average", "Low"),
    "momentum": ("Positive", "Mixed", "Negative"),
}


def _pillar(name: str, score: int | None, points: list[str], good_at: int = 1, bad_at: int = -1) -> dict:
    if score is None or not points:
        return {"name": name, "tone": "na", "label": "Not enough data", "points": points}
    good, neutral, bad = LABELS[name]
    tone = "good" if score >= good_at else "bad" if score <= bad_at else "neutral"
    return {"name": name, "tone": tone, "label": {"good": good, "neutral": neutral, "bad": bad}[tone], "points": points}


def build_scorecard(s: dict, f: dict, peers: dict | None) -> dict:
    """Rate valuation, growth, quality and momentum, and list red flags. Pure function of the fetched data."""
    financial_sector = (s.get("sector") or "").lower().startswith("financial") or sector_of(s["symbol"]) in (
        "banking",
        "nbfc",
        "insurance",
    )
    flags: list[str] = []

    # Valuation: P/E against the company's own past and its peers (±10% bands).
    score, points = None, []
    pe = s.get("pe")
    if pe and pe > 0:
        score = 0
        hist = f.get("pe_median_history")
        if hist:
            gap = round((pe / hist - 1) * 100, 1)
            score += 1 if gap <= -10 else -1 if gap >= 10 else 0
            points.append(f"P/E {pe:.1f} vs its own {len(f['pe_history'])}-year median {hist:.1f} ({gap:+.1f}%)")
            if gap >= 40:
                flags.append(f"Valued {gap:.1f}% above its own historical P/E")
        if peers and peers.get("pe_median"):
            gap = round((pe / peers["pe_median"] - 1) * 100, 1)
            score += 1 if gap <= -10 else -1 if gap >= 10 else 0
            points.append(
                f"P/E {pe:.1f} vs {sector_name(peers['sector'])} peer median {peers['pe_median']:.1f} ({gap:+.1f}%)"
            )
            if gap >= 50:
                flags.append(f"P/E {gap:.1f}% above the peer median")
        if not points:
            score, points = None, [f"P/E {pe:.1f} (no history or peers to compare)"]
    elif pe is not None or (f.get("annual") and f["annual"][-1]["net_income"] <= 0):
        flags.append("Loss-making — P/E not meaningful")
    valuation = _pillar("valuation", score, points)

    # Growth: 3-year revenue and profit CAGR (strong ≥ 8% / 12%; weak < 3% / 4%).
    score, points = None, []
    rev, prof = f.get("revenue_cagr_pct"), f.get("profit_cagr_pct")
    if rev is not None or prof is not None:
        score = 0
        yrs = f.get("cagr_years", 3)
        if rev is not None:
            points.append(f"Revenue {rev:+.1f}% a year over {yrs} years")
            score += 1 if rev >= 8 else -1 if rev < 3 else 0
        if prof is not None:
            points.append(f"Net profit {prof:+.1f}% a year over {yrs} years")
            score += 1 if prof >= 12 else -1 if prof < 4 else 0
        # Lenders' revenue swings with interest rates (and mergers), so this rule only applies to other companies.
        if rev is not None and prof is not None and prof < rev - 8 and not financial_sector:
            flags.append(f"Profit growth ({prof:+.1f}%) lagging revenue growth ({rev:+.1f}%)")
    q_profit = f.get("quarter_profit_yoy_pct")
    if q_profit is not None:
        points.append(
            f"{f['latest_quarter']} quarter: revenue {f['quarter_revenue_yoy_pct']:+.1f}%, "
            f"profit {q_profit:+.1f}% year on year"
        )
        if q_profit <= -15:
            flags.append(f"Latest quarterly profit down {abs(q_profit):.1f}% year on year")
    growth = _pillar("growth", score, points, good_at=2, bad_at=-1)

    # Quality: ROE (≥ 18% good, < 10% weak), leverage for non-financials, margin trend.
    score, points = None, []
    roe = s.get("roe_pct")
    if roe is not None:
        score = 1 if roe >= 18 else -1 if roe < 10 else 0
        peer_roe = f" (peer median {peers['roe_median_pct']:.1f}%)" if peers and peers.get("roe_median_pct") else ""
        points.append(f"ROE {roe:.1f}%{peer_roe}")
    de = s.get("debt_to_equity")
    if de is not None and not financial_sector:
        score = (score or 0) + (1 if de <= 0.5 else -1 if de > 1.5 else 0)
        points.append(f"Debt/equity {de:.2f}")
        if de > 1.5:
            flags.append(f"High debt: debt/equity {de:.2f}")
    margin_change = f.get("margin_change_pp")
    if margin_change is not None and f.get("annual") and not financial_sector:
        latest_margin = f["annual"][-1]["net_margin_pct"]
        points.append(f"Net margin {latest_margin:.1f}% ({margin_change:+.1f} pts vs earlier years)")
        if margin_change <= -2:
            score = (score or 0) - 1
            flags.append(f"Net margin down {abs(margin_change):.1f} pts vs earlier years")
    quality = _pillar("quality", score, points, good_at=2)

    # Momentum: price vs 50/200-day averages and distance from the 52-week high.
    score, points = None, []
    v50, v200, high = s.get("vs_dma50_pct"), s.get("vs_dma200_pct"), s.get("from_52w_high_pct")
    if v200 is not None or v50 is not None:
        score = 0
        if v200 is not None:
            score += 1 if v200 > 0 else -1
            points.append(f"{v200:+.1f}% vs 200-day average")
        if v50 is not None:
            score += 1 if v50 > 0 else -1
            points.append(f"{v50:+.1f}% vs 50-day average")
        if high is not None:
            score += 1 if high >= -10 else -1 if high <= -30 else 0
            points.append(f"{high:+.1f}% from the 52-week high")
    momentum = _pillar("momentum", score, points, good_at=2, bad_at=-2)

    if (dd := s.get("max_drawdown_pct")) is not None and dd <= -35:
        flags.append(f"Fell {abs(dd):.1f}% from peak within the past year")
    if (vol := s.get("volatility_pct")) is not None and vol >= 45:
        flags.append(f"Very volatile: {vol:.1f}% annualised")

    pillars = [valuation, growth, quality, momentum]
    return {
        "pillars": pillars,
        "red_flags": flags,
        "positives": sum(p["tone"] == "good" for p in pillars),
        "negatives": sum(p["tone"] == "bad" for p in pillars),
    }


# ── Report ────────────────────────────────────────────────────────────────────


async def get_stock_report(name_or_symbol: str) -> dict:
    listing = market._resolve_one(name_or_symbol)
    snapshot = await market._snapshot_cached(listing.symbol)
    if listing.is_index:
        return snapshot
    shares = None
    if snapshot.get("market_cap") and snapshot.get("price"):
        shares = snapshot["market_cap"] / snapshot["price"]
    financials, peers = await asyncio.gather(_financials_cached(snapshot["ticker"], shares), peer_stats(listing.symbol))
    return {
        "kind": "report",
        "symbol": listing.symbol,
        "snapshot": snapshot,
        "financials": financials,
        "peers": peers,
        "scorecard": build_scorecard(snapshot, financials, peers),
        "sources": snapshot["sources"],
    }


def report_text(r: dict) -> str:
    if r.get("kind") == "stock":
        return market.snapshot_text(r)
    f, peers, card = r["financials"], r["peers"], r["scorecard"]
    lines = [market.snapshot_text(r["snapshot"]), ""]
    if f.get("annual"):
        lines.append("Annual results (revenue / net profit / net margin) — may include one-off gains or mergers:")
        for y in f["annual"]:
            profit = fmt.inr(y["net_income"])
            lines.append(f"- {y['fy']}: {fmt.inr(y['revenue'])} / {profit} / {y['net_margin_pct']:.1f}%")
    if f.get("quarters"):
        lines.append("Recent quarters (revenue / net profit):")
        for q in f["quarters"]:
            lines.append(f"- {q['quarter']}: {fmt.inr(q['revenue'])} / {fmt.inr(q['net_income'])}")
    if f.get("pe_history"):
        lines.append(f"P/E at past fiscal year ends: {', '.join(f'{v:.1f}' for v in f['pe_history'])}")
    if peers:
        lines.append(
            f"Peers ({sector_name(peers['sector'])}: {', '.join(peers['symbols'])}): "
            f"median P/E {fmt.ratio(peers['pe_median'], 1)}, "
            f"median P/B {fmt.ratio(peers['pb_median'], 1)}, median ROE {fmt.pct(peers['roe_median_pct'])}, "
            f"median 1Y return {fmt.pct(peers['return_1y_median_pct'], 1, signed=True)}"
        )
    lines += ["", "FinSage scorecard (rule-based screen, not a recommendation — explain it, don't change its numbers):"]
    for p in card["pillars"]:
        lines.append(f"- {p['name'].title()}: {p['label']} — {'; '.join(p['points']) or 'n/a'}")
    lines.append("- Red flags: " + ("; ".join(card["red_flags"]) if card["red_flags"] else "none found"))
    return "\n".join(lines)
