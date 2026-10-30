"""Stock / index snapshots and peer comparison, via Yahoo Finance (yfinance) with caching."""

import asyncio
import logging
import math
import re

import yfinance as yf

from backend import config
from backend.tools import fmt, symbols
from backend.tools.cache import ttl_cache

log = logging.getLogger(__name__)

# Representative large caps per sector. Symbols not in the NSE list are skipped at runtime.
SECTORS = {
    "banking": ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK"],
    "it": ["TCS", "INFY", "HCLTECH", "WIPRO", "TECHM"],
    "pharma": ["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "LUPIN"],
    "auto": ["MARUTI", "M&M", "BAJAJ-AUTO", "EICHERMOT", "HEROMOTOCO"],
    "fmcg": ["HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR"],
    "energy": ["RELIANCE", "ONGC", "NTPC", "POWERGRID", "COALINDIA"],
    "metals": ["TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "SAIL"],
    "telecom": ["BHARTIARTL", "INDUSTOWER", "IDEA"],
    "realty": ["DLF", "GODREJPROP", "OBEROIRLTY", "PRESTIGE", "LODHA"],
    "cement": ["ULTRACEMCO", "AMBUJACEM", "SHREECEM", "ACC"],
    "nbfc": ["BAJFINANCE", "BAJAJFINSV", "CHOLAFIN", "SHRIRAMFIN", "MUTHOOTFIN"],
    "insurance": ["HDFCLIFE", "SBILIFE", "ICICIPRULI", "ICICIGI", "LICI"],
    "defence": ["HAL", "BEL", "BDL", "MAZDOCK"],
}

SECTOR_KEYWORDS = {
    "banking": ["bank", "banks", "banking", "psu bank", "psu banks", "private bank", "private banks"],
    "it": ["it sector", "it stocks", "it companies", "it shares", "tech", "software", "technology", "infotech"],
    "pharma": ["pharma", "pharmaceutical", "pharmaceuticals", "healthcare", "drug makers"],
    "auto": ["auto", "autos", "automobile", "automobiles", "car makers", "two wheeler", "two wheelers", "ev stocks"],
    "fmcg": ["fmcg", "consumer goods", "consumer staples"],
    "energy": ["energy", "oil", "oil and gas", "power", "utilities", "utility"],
    "metals": ["metal", "metals", "steel", "mining", "aluminium"],
    "telecom": ["telecom", "telecommunication"],
    "realty": ["realty", "real estate", "property"],
    "cement": ["cement"],
    "nbfc": ["nbfc", "nbfcs", "lending", "finance companies"],
    "insurance": ["insurance", "insurer", "insurers"],
    "defence": ["defence", "defense"],
}


def detect_sector(text: str) -> str | None:
    if re.search(r"\bIT\b", text):
        return "it"
    t = symbols.norm(text)
    for sector, words in SECTOR_KEYWORDS.items():
        if any(re.search(rf"\b{re.escape(w)}\b", t) for w in words):
            return sector
    return None


def sector_symbols(sector: str) -> list[str]:
    known = symbols.all_listings()
    return [s for s in SECTORS.get(sector.lower().strip(), []) if s in known]


def technicals(closes, adj_closes=None) -> dict:
    """Trend and risk measures from ~1 year of daily closes (pandas Series, oldest first).

    Returns use dividend-adjusted closes when available (total return); moving averages use plain closes.
    """
    closes = closes.dropna()
    adj = adj_closes.dropna() if adj_closes is not None else closes
    if len(closes) < 2:
        return {}
    last, adj_last = float(closes.iloc[-1]), float(adj.iloc[-1])

    def ret(series, days):
        if len(series) <= days:
            return None
        then = float(series.iloc[-days - 1])
        return round((float(series.iloc[-1]) / then - 1) * 100, 2) if then else None

    def dma(n):
        return round(float(closes.iloc[-n:].mean()), 2) if len(closes) >= n else None

    dma50, dma200 = dma(50), dma(200)
    daily = adj.pct_change().dropna()
    running_max = adj.cummax()
    return {
        "return_1y_pct": round((adj_last / float(adj.iloc[0]) - 1) * 100, 2),
        "price_return_1y_pct": round((last / float(closes.iloc[0]) - 1) * 100, 2),
        "return_3m_pct": ret(adj, 63),
        "return_6m_pct": ret(adj, 126),
        "dma50": dma50,
        "dma200": dma200,
        "vs_dma50_pct": round((last / dma50 - 1) * 100, 2) if dma50 else None,
        "vs_dma200_pct": round((last / dma200 - 1) * 100, 2) if dma200 else None,
        "from_52w_high_pct": round((last / float(closes.max()) - 1) * 100, 2),
        "volatility_pct": round(float(daily.std()) * math.sqrt(252) * 100, 1) if len(daily) > 20 else None,
        "max_drawdown_pct": round(float(((adj / running_max) - 1).min()) * 100, 2),
    }


def _resolve_one(name_or_symbol: str) -> symbols.Listing:
    exact = symbols.lookup(name_or_symbol)
    if exact:
        return exact
    matches = symbols.resolve(name_or_symbol, limit=1)
    if not matches:
        raise LookupError(f"Couldn't find an NSE-listed company or index matching '{name_or_symbol}'.")
    return matches[0]


def _fetch_sync(listing: symbols.Listing) -> dict:
    tickers = [listing.symbol] if listing.is_index else [f"{listing.symbol}.NS", f"{listing.symbol}.BO"]
    for ticker in tickers:
        tk = yf.Ticker(ticker)
        hist = tk.history(period="1y", interval="1d", auto_adjust=False)
        if hist is None or hist.empty:
            continue
        try:
            info = tk.info or {}
        except Exception as e:  # Yahoo's quoteSummary is flaky; price history is enough to answer.
            log.warning("yfinance info failed for %s: %s", ticker, e)
            info = {}

        closes = hist["Close"].dropna()
        last = float(closes.iloc[-1])
        price = fmt.num(info.get("currentPrice")) or fmt.num(info.get("regularMarketPrice")) or last
        prev = fmt.num(info.get("previousClose")) or fmt.num(info.get("regularMarketPreviousClose"))
        if prev is None and len(closes) > 1:
            prev = float(closes.iloc[-2])
        change = price - prev if prev else None
        trend = technicals(closes, hist["Adj Close"] if "Adj Close" in hist else None)

        roe, de = fmt.num(info.get("returnOnEquity")), fmt.num(info.get("debtToEquity"))
        margin, rev_growth = fmt.num(info.get("profitMargins")), fmt.num(info.get("revenueGrowth"))
        chart = [[d.strftime("%Y-%m-%d"), round(float(c), 2)] for d, c in closes.items()]

        return {
            "kind": "stock",
            "symbol": listing.symbol,
            "ticker": ticker,
            "exchange": "Index" if listing.is_index else ("NSE" if ticker.endswith(".NS") else "BSE"),
            "name": info.get("longName") or symbols.display_name(listing),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "currency": info.get("currency") or "INR",
            "price": round(price, 2),
            "change": round(change, 2) if change is not None else None,
            "change_pct": round(change / prev * 100, 2) if change is not None and prev else None,
            "day_high": fmt.num(info.get("dayHigh")),
            "day_low": fmt.num(info.get("dayLow")),
            "high_52w": fmt.num(info.get("fiftyTwoWeekHigh")) or round(float(hist["High"].max()), 2),
            "low_52w": fmt.num(info.get("fiftyTwoWeekLow")) or round(float(hist["Low"].min()), 2),
            **trend,
            "market_cap": fmt.num(info.get("marketCap")),
            "pe": fmt.num(info.get("trailingPE")),
            "forward_pe": fmt.num(info.get("forwardPE")),
            "pb": fmt.num(info.get("priceToBook")),
            "eps": fmt.num(info.get("trailingEps")),
            # yfinance: ROE/margins/growth are fractions, debtToEquity is ×100, dividendYield is already %.
            "roe_pct": round(roe * 100, 2) if roe is not None else None,
            "debt_to_equity": round(de / 100, 2) if de is not None else None,
            "dividend_yield_pct": fmt.num(info.get("dividendYield")),
            "profit_margin_pct": round(margin * 100, 2) if margin is not None else None,
            "revenue_growth_pct": round(rev_growth * 100, 2) if rev_growth is not None else None,
            "as_of": closes.index[-1].strftime("%Y-%m-%d"),
            "chart": fmt.downsample(chart, 60),
            "sources": [
                {
                    "title": f"{listing.symbol} on Yahoo Finance",
                    "url": f"https://finance.yahoo.com/quote/{ticker}",
                    "source": "Yahoo Finance",
                }
            ],
        }
    raise LookupError(f"No market data available right now for {listing.symbol}.")


@ttl_cache(config.MARKET_CACHE_SECONDS, maxsize=256)
async def _snapshot_cached(symbol: str) -> dict:
    listing = symbols.lookup(symbol)
    return await asyncio.to_thread(_fetch_sync, listing)


async def get_stock_snapshot(name_or_symbol: str) -> dict:
    listing = _resolve_one(name_or_symbol)
    return await _snapshot_cached(listing.symbol)


def snapshot_text(d: dict) -> str:
    is_index = d.get("exchange") == "Index"
    unit = "" if is_index else "₹"
    lines = [
        f"{d['name']} ({d['symbol']}, {d['exchange']}) as of {d['as_of']}",
        f"Price: {unit}{fmt.indian_grouping(d['price'], 2)} ({fmt.pct(d.get('change_pct'), 2, signed=True)} today)",
        f"Returns incl. dividends: 3M {fmt.pct(d.get('return_3m_pct'), 1, signed=True)}, "
        f"6M {fmt.pct(d.get('return_6m_pct'), 1, signed=True)}, 1Y {fmt.pct(d.get('return_1y_pct'), 1, signed=True)} "
        f"(1Y price only {fmt.pct(d.get('price_return_1y_pct'), 1, signed=True)})",
        f"52-week range: {unit}{fmt.indian_grouping(d['low_52w'] or 0, 2)} – "
        f"{unit}{fmt.indian_grouping(d['high_52w'] or 0, 2)} ({fmt.pct(d.get('from_52w_high_pct'), 1, signed=True)} "
        "from the high)",
        f"Trend: {fmt.pct(d.get('vs_dma50_pct'), 1, signed=True)} vs 50-day average, "
        f"{fmt.pct(d.get('vs_dma200_pct'), 1, signed=True)} vs 200-day average; "
        f"volatility {fmt.pct(d.get('volatility_pct'))} a year; max drawdown {fmt.pct(d.get('max_drawdown_pct'), 1)}",
    ]
    if not is_index:
        lines += [
            f"Sector: {d.get('sector') or 'n/a'} / {d.get('industry') or 'n/a'}; "
            f"Market cap: {fmt.inr(d.get('market_cap'))}",
            f"P/E: {fmt.ratio(d.get('pe'))} (forward {fmt.ratio(d.get('forward_pe'))}); "
            f"P/B: {fmt.ratio(d.get('pb'))}; EPS: {fmt.ratio(d.get('eps'))}",
            f"ROE: {fmt.pct(d.get('roe_pct'))}; Debt/Equity: {fmt.ratio(d.get('debt_to_equity'))}; "
            f"Dividend yield: {fmt.pct(d.get('dividend_yield_pct'), 2)}; "
            f"Profit margin: {fmt.pct(d.get('profit_margin_pct'))}; "
            f"Revenue growth (YoY): {fmt.pct(d.get('revenue_growth_pct'), 1, signed=True)}",
        ]
    return "\n".join(lines)


async def compare_stocks(names_or_symbols: list[str]) -> dict:
    wanted, errors = [], []
    for item in names_or_symbols[:6]:
        try:
            listing = _resolve_one(item)
            if listing.symbol not in [w.symbol for w in wanted]:
                wanted.append(listing)
        except LookupError as e:
            errors.append(str(e))
    if not wanted:
        raise LookupError("None of those companies could be found on NSE.")

    results = await asyncio.gather(*(_snapshot_cached(w.symbol) for w in wanted), return_exceptions=True)
    rows = []
    for listing, r in zip(wanted, results, strict=True):
        if isinstance(r, Exception):
            errors.append(f"{listing.symbol}: {r}")
        else:
            rows.append(
                {
                    k: r.get(k)
                    for k in (
                        "symbol",
                        "name",
                        "sector",
                        "price",
                        "change_pct",
                        "return_1y_pct",
                        "market_cap",
                        "pe",
                        "pb",
                        "roe_pct",
                        "debt_to_equity",
                        "dividend_yield_pct",
                    )
                }
            )
    if not rows:
        raise LookupError("Market data is unavailable for all requested companies right now.")

    def best(key, highest=True):
        vals = [r for r in rows if r.get(key) is not None and (key != "pe" or r[key] > 0)]
        if not vals:
            return None
        pick = (max if highest else min)(vals, key=lambda r: r[key])
        return pick["symbol"]

    return {
        "kind": "compare",
        "rows": rows,
        "highlights": {
            "lowest_pe": best("pe", highest=False),
            "highest_roe": best("roe_pct"),
            "best_1y_return": best("return_1y_pct"),
            "lowest_debt": best("debt_to_equity", highest=False),
        },
        "errors": errors,
        "sources": [{"title": "Yahoo Finance (NSE)", "url": "https://finance.yahoo.com", "source": "Yahoo Finance"}],
    }


def compare_text(d: dict) -> str:
    lines = ["Symbol | Price | Today | 1Y | Mkt cap | P/E | P/B | ROE | D/E | Div yield"]
    for r in d["rows"]:
        lines.append(
            " | ".join(
                [
                    r["symbol"],
                    f"₹{fmt.indian_grouping(r['price'], 2)}",
                    fmt.pct(r.get("change_pct"), 2, True),
                    fmt.pct(r.get("return_1y_pct"), 1, True),
                    fmt.inr(r.get("market_cap")),
                    fmt.ratio(r.get("pe")),
                    fmt.ratio(r.get("pb")),
                    fmt.pct(r.get("roe_pct")),
                    fmt.ratio(r.get("debt_to_equity")),
                    fmt.pct(r.get("dividend_yield_pct"), 2),
                ]
            )
        )
    h = {k: v for k, v in d["highlights"].items() if v}
    if h:
        lines.append("Highlights: " + ", ".join(f"{k.replace('_', ' ')} = {v}" for k, v in h.items()))
    if d.get("errors"):
        lines.append("Unavailable: " + "; ".join(d["errors"]))
    return "\n".join(lines)
