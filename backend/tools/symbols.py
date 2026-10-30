"""Resolve company names / tickers against the official NSE equity list (data/nse_equity.csv).

Refresh the CSV from https://archives.nseindia.com/content/equities/EQUITY_L.csv
"""

import csv
import re
from collections import defaultdict
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "nse_equity.csv"


@dataclass(frozen=True)
class Listing:
    symbol: str
    name: str

    @property
    def is_index(self) -> bool:
        return self.symbol.startswith("^")


INDICES = {
    "^NSEI": "NIFTY 50",
    "^BSESN": "S&P BSE SENSEX",
    "^NSEBANK": "NIFTY BANK",
    "^CNXIT": "NIFTY IT",
}

# Everyday names → NSE symbols. Entries whose symbol isn't in the CSV are dropped at load.
ALIASES = {
    "nifty": "^NSEI",
    "nifty 50": "^NSEI",
    "nifty50": "^NSEI",
    "sensex": "^BSESN",
    "bank nifty": "^NSEBANK",
    "banknifty": "^NSEBANK",
    "nifty bank": "^NSEBANK",
    "nifty it": "^CNXIT",
    "tcs": "TCS",
    "tata consultancy": "TCS",
    "infosys": "INFY",
    "infy": "INFY",
    "wipro": "WIPRO",
    "hcl": "HCLTECH",
    "hcl tech": "HCLTECH",
    "hcl technologies": "HCLTECH",
    "tech mahindra": "TECHM",
    "reliance": "RELIANCE",
    "ril": "RELIANCE",
    "reliance industries": "RELIANCE",
    "hdfc": "HDFCBANK",
    "hdfc bank": "HDFCBANK",
    "icici": "ICICIBANK",
    "icici bank": "ICICIBANK",
    "sbi": "SBIN",
    "state bank": "SBIN",
    "state bank of india": "SBIN",
    "kotak": "KOTAKBANK",
    "kotak bank": "KOTAKBANK",
    "kotak mahindra bank": "KOTAKBANK",
    "axis": "AXISBANK",
    "axis bank": "AXISBANK",
    "indusind": "INDUSINDBK",
    "indusind bank": "INDUSINDBK",
    "bank of baroda": "BANKBARODA",
    "pnb": "PNB",
    "airtel": "BHARTIARTL",
    "bharti airtel": "BHARTIARTL",
    "jio financial": "JIOFIN",
    "vodafone idea": "IDEA",
    "hul": "HINDUNILVR",
    "hindustan unilever": "HINDUNILVR",
    "itc": "ITC",
    "nestle": "NESTLEIND",
    "britannia": "BRITANNIA",
    "dabur": "DABUR",
    "asian paints": "ASIANPAINT",
    "titan": "TITAN",
    "l&t": "LT",
    "larsen": "LT",
    "larsen & toubro": "LT",
    "larsen and toubro": "LT",
    "maruti": "MARUTI",
    "maruti suzuki": "MARUTI",
    "m&m": "M&M",
    "mahindra": "M&M",
    "mahindra and mahindra": "M&M",
    "mahindra & mahindra": "M&M",
    "bajaj auto": "BAJAJ-AUTO",
    "eicher": "EICHERMOT",
    "royal enfield": "EICHERMOT",
    "hero motocorp": "HEROMOTOCO",
    "tvs motor": "TVSMOTOR",
    "bajaj finance": "BAJFINANCE",
    "bajaj finserv": "BAJAJFINSV",
    "sun pharma": "SUNPHARMA",
    "dr reddy": "DRREDDY",
    "dr reddys": "DRREDDY",
    "cipla": "CIPLA",
    "divis": "DIVISLAB",
    "lupin": "LUPIN",
    "ongc": "ONGC",
    "ntpc": "NTPC",
    "power grid": "POWERGRID",
    "coal india": "COALINDIA",
    "tata steel": "TATASTEEL",
    "jsw steel": "JSWSTEEL",
    "hindalco": "HINDALCO",
    "vedanta": "VEDL",
    "adani enterprises": "ADANIENT",
    "adani ports": "ADANIPORTS",
    "adani green": "ADANIGREEN",
    "adani power": "ADANIPOWER",
    "ultratech": "ULTRACEMCO",
    "ultratech cement": "ULTRACEMCO",
    "zomato": "ETERNAL",
    "eternal": "ETERNAL",
    "swiggy": "SWIGGY",
    "paytm": "PAYTM",
    "nykaa": "NYKAA",
    "irctc": "IRCTC",
    "hal": "HAL",
    "hindustan aeronautics": "HAL",
    "bel": "BEL",
    "bharat electronics": "BEL",
    "dmart": "DMART",
    "avenue supermarts": "DMART",
    "tata power": "TATAPOWER",
    "lic": "LICI",
    "ola electric": "OLAELEC",
    "trent": "TRENT",
    "pidilite": "PIDILITIND",
    "dlf": "DLF",
    "polycab": "POLYCAB",
    "zydus": "ZYDUSLIFE",
    "tata elxsi": "TATAELXSI",
    "persistent": "PERSISTENT",
    "mazagon dock": "MAZDOCK",
    "irfc": "IRFC",
    "yes bank": "YESBANK",
    "idfc first": "IDFCFIRSTB",
    "hdfc life": "HDFCLIFE",
    "hdfc amc": "HDFCAMC",
    "sbi life": "SBILIFE",
    "sbi card": "SBICARD",
    "sbi cards": "SBICARD",
    "icici prudential": "ICICIPRULI",
    "icici pru": "ICICIPRULI",
    "icici lombard": "ICICIGI",
    "kotak securities": "KOTAKBANK",
    "bajaj housing": "BAJAJHFL",
}

# Upper-case tokens that look like tickers but are finance jargon.
TICKER_STOP = {
    "I",
    "A",
    "IT",
    "AI",
    "US",
    "UK",
    "EV",
    "IPO",
    "SIP",
    "SIPS",
    "NAV",
    "MF",
    "PE",
    "PB",
    "EPS",
    "ETF",
    "GDP",
    "RBI",
    "SEBI",
    "NSE",
    "BSE",
    "FD",
    "FDS",
    "EMI",
    "ROE",
    "ROCE",
    "ELSS",
    "PPF",
    "NPS",
    "UPI",
    "INR",
    "USD",
    "CEO",
    "CFO",
    "FY",
    "YOY",
    "QOQ",
    "LTCG",
    "STCG",
    "TDS",
    "GST",
    "OK",
    "AMC",
    "CAGR",
    "XIRR",
    "EBITDA",
    "PAT",
    "DII",
    "FII",
    "FPI",
    "Q1",
    "Q2",
    "Q3",
    "Q4",
    "MSCI",
    "PSU",
    "NBFC",
    "AUM",
    "KYC",
    "PAN",
    "HNI",
    "TER",
    "SWP",
    "STP",
    "IDCW",
    "NFO",
    "REIT",
    "SGB",
    "EPF",
    "VS",
    "AND",
    "OR",
    "THE",
    "TO",
    "IN",
    "OF",
}

STOP = set(
    """
a an the and or of in on for to is are was be been should shall i me my we our you your it its this that these
those what which who whom how why when where will would can could do does did buy sell hold invest investing
investment invested stock stocks share shares price prices company companies best top good bad better worse
compare comparison vs versus with about now today right time long short term market markets sector sectors fund
funds mutual india indian bank banks banking ltd limited per month monthly year years yearly sip sips returns
return value growth news latest update updates analysis analyse analyze tell give show between than more less
much many worth safe risky risk all any some get make money rs inr lakh lakhs crore crores k next last quarter
results dividend dividends portfolio plan goal every each also from into over under up down high low new old big
small large mid cap caps capital should if so not no yes please want need like know think there their them
theory looks look looking strong strongest weak weakest good great is it am being has have had my mine
""".split()
)

# Extra words that are too generic to identify a company on their own.
COMMON = STOP | set(
    """
power energy green gold silver future global finance financial services technologies technology industries
international national general united royal star sun prime first super digital media health life care home
city steel motors auto oil gas infra housing insurance pharma chemicals foods paints cement electric systems
solutions products textiles agro hotels retail tata adani bajaj birla mahindra reliance godrej jindal
""".split()
)


def norm(text: str) -> str:
    t = text.lower().replace("’", "").replace("'", "")
    t = re.sub(r"[^a-z0-9&\s-]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def norm_name(name: str) -> str:
    t = re.sub(r"\b(limited|ltd)\b\.?\s*$", "", norm(name)).strip()
    return t[4:] if t.startswith("the ") else t


@lru_cache(maxsize=1)
def _db():
    listings: dict[str, Listing] = {}
    with open(DATA_FILE, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            row = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
            symbol, name = row.get("SYMBOL"), row.get("NAME OF COMPANY")
            if symbol and name:
                listings[symbol] = Listing(symbol, name)
    for symbol, name in INDICES.items():
        listings[symbol] = Listing(symbol, name)

    names = {s: norm_name(listing.name) for s, listing in listings.items()}
    first_word = defaultdict(list)
    for s, n in names.items():
        if n and not s.startswith("^"):
            first_word[n.split()[0]].append(s)
    aliases = {a: s for a, s in ALIASES.items() if s in listings}
    return listings, names, first_word, aliases


def all_listings() -> dict[str, Listing]:
    return _db()[0]


def lookup(symbol: str) -> Listing | None:
    s = re.sub(r"\.(NS|BO)$", "", symbol.strip().upper())
    return _db()[0].get(s)


def display_name(listing: Listing) -> str:
    return re.sub(r"\s+(Limited|Ltd\.?)$", "", listing.name, flags=re.I)


def resolve(query: str, limit: int = 5) -> list[Listing]:
    """Best matches for a name or symbol, most likely first."""
    listings, names, _, aliases = _db()
    raw = re.sub(r"\.(ns|bo)$", "", query.strip(), flags=re.I)
    q = norm(raw)
    if not q:
        return []

    ranked: list[str] = []

    def add(symbols):
        for s in symbols:
            if s in listings and s not in ranked:
                ranked.append(s)

    if q in aliases:
        add([aliases[q]])
    add([raw.upper().replace(" ", "")])
    add(sorted((s for s, n in names.items() if n == q), key=len))
    add(sorted((s for s, n in names.items() if n.startswith(q + " ")), key=lambda s: len(names[s])))
    tokens = q.split()
    add(
        sorted(
            (s for s, n in names.items() if all(re.search(rf"\b{re.escape(t)}", n) for t in tokens)),
            key=lambda s: len(names[s]),
        )
    )
    return [listings[s] for s in ranked[:limit]]


def extract_companies(text: str, limit: int = 5) -> list[str]:
    """Symbols of companies/indices mentioned in free text, in order of appearance."""
    listings, names, first_word, aliases = _db()
    found: list[tuple[int, str]] = []

    def add(pos: int, symbol: str):
        if symbol in listings and symbol not in [s for _, s in found]:
            found.append((pos, symbol))

    q = norm(text)
    masked = q
    for alias in sorted(aliases, key=len, reverse=True):
        pattern = rf"(?<![a-z0-9&]){re.escape(alias)}(?![a-z0-9&])"
        m = re.search(pattern, masked)
        if m:
            add(m.start(), aliases[alias])
            masked = re.sub(pattern, lambda x: " " * len(x.group()), masked)

    for m in re.finditer(r"\b[A-Z][A-Z0-9&-]{1,14}\b", text):
        tok = m.group()
        if tok in listings and tok not in TICKER_STOP:
            add(q.find(tok.lower()), tok)

    words = [(m.start(), m.group()) for m in re.finditer(r"\S+", masked)]
    used: set[int] = set()
    for n in (3, 2):
        for i in range(len(words) - n + 1):
            if any(j in used for j in range(i, i + n)):
                continue
            gram = [w for _, w in words[i : i + n]]
            if gram[0] in STOP or gram[-1] in STOP:
                continue
            phrase = " ".join(gram)
            matches = [
                s for s, nm in names.items() if not s.startswith("^") and (nm == phrase or nm.startswith(phrase + " "))
            ]
            if 1 <= len(matches) <= 3:
                add(words[i][0], min(matches, key=lambda s: len(names[s])))
                used.update(range(i, i + n))

    for i, (pos, w) in enumerate(words):
        if i in used or len(w) < 4 or w in COMMON:
            continue
        matches = first_word.get(w, [])
        if 1 <= len(matches) <= 2:
            add(pos, min(matches, key=lambda s: len(names[s])))

    return [s for _, s in sorted(found)][:limit]
