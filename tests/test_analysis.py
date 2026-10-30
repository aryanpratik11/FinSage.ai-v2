import pandas as pd
import pytest

from backend.agent.verify import check
from backend.tools import analysis, market, tax


def series(values, start="2025-11-01", freq="B"):
    return pd.Series(values, index=pd.date_range(start, periods=len(values), freq=freq), dtype=float)


def test_technicals_on_a_steady_uptrend():
    t = market.technicals(series([100 + i for i in range(250)]))
    assert t["price_return_1y_pct"] == pytest.approx(249.0)
    assert t["vs_dma50_pct"] > 0 and t["vs_dma200_pct"] > 0
    assert t["from_52w_high_pct"] == 0
    assert t["max_drawdown_pct"] == 0


def test_total_return_uses_adjusted_closes():
    closes = series([100.0] * 250)
    adjusted = series([96.0] * 249 + [100.0])  # dividends paid along the way
    t = market.technicals(closes, adjusted)
    assert t["price_return_1y_pct"] == 0
    assert t["return_1y_pct"] == pytest.approx(4.17, abs=0.01)


def test_drawdown_and_distance_from_high():
    t = market.technicals(series([100] * 50 + [150] * 50 + [90] * 50))
    assert t["max_drawdown_pct"] == pytest.approx(-40.0)
    assert t["from_52w_high_pct"] == pytest.approx(-40.0)


def statement(rows: dict, ends: list[str]) -> pd.DataFrame:
    """yfinance-shaped statement: metrics as rows, period ends as columns (newest first)."""
    cols = [pd.Timestamp(e) for e in ends]
    return pd.DataFrame({c: {k: v[i] for k, v in rows.items()} for i, c in enumerate(cols)})


def test_financials_growth_margins_and_pe_history():
    annual = statement(
        {"Total Revenue": [1331, 1210, 1100, 1000], "Net Income": [266, 230, 198, 170]},
        ["2026-03-31", "2025-03-31", "2024-03-31", "2023-03-31"],
    )
    quarterly = statement(
        {"Total Revenue": [350, 340, 330, 320, 300], "Net Income": [70, 68, 66, 64, 60]},
        ["2026-09-30", "2026-06-30", "2026-03-31", "2025-12-31", "2025-09-30"],
    )
    weekly = series([10.0] * 200, start="2022-11-01", freq="W")
    f = analysis.compute_financials(annual, quarterly, weekly, shares=500)

    assert [y["fy"] for y in f["annual"]] == ["FY23", "FY24", "FY25", "FY26"]
    assert f["revenue_cagr_pct"] == pytest.approx(10.0, abs=0.05)
    assert f["profit_cagr_pct"] == pytest.approx(16.1, abs=0.1)
    assert f["latest_quarter"] == "Sep 2026"
    assert f["quarter_revenue_yoy_pct"] == pytest.approx(16.67, abs=0.01)
    assert f["pe_history"] == [29.4, 25.3, 21.7, 18.8]  # price 10 × 500 shares / net income


def test_quarter_yoy_skipped_when_year_ago_quarter_missing():
    quarterly = statement({"Total Revenue": [350, 340], "Net Income": [70, 68]}, ["2026-09-30", "2026-06-30"])
    f = analysis.compute_financials(pd.DataFrame(), quarterly, pd.Series(dtype=float), None)
    assert "quarter_revenue_yoy_pct" not in f and len(f["quarters"]) == 2


SNAPSHOT = {
    "symbol": "TCS",
    "sector": "Technology",
    "pe": 17.5,
    "roe_pct": 45.6,
    "debt_to_equity": 0.1,
    "vs_dma50_pct": 10.5,
    "vs_dma200_pct": 2.9,
    "from_52w_high_pct": -24.7,
    "max_drawdown_pct": -38.5,
    "volatility_pct": 30.1,
}
FINANCIALS = {
    "annual": [{"fy": "FY26", "revenue": 2.67e12, "net_income": 4.92e11, "net_margin_pct": 18.4}],
    "revenue_cagr_pct": 5.8,
    "profit_cagr_pct": 5.3,
    "cagr_years": 3,
    "margin_change_pp": -0.5,
    "pe_history": [27.6, 31.4, 24.1, 18.6],
    "pe_median_history": 25.9,
}
PEERS = {"sector": "it", "symbols": ["INFY"], "pe_median": 18.4, "pb_median": 5.0, "roe_median_pct": 21.9}


def test_scorecard_ratings_and_flags():
    card = analysis.build_scorecard(SNAPSHOT, FINANCIALS, PEERS)
    labels = {p["name"]: p["label"] for p in card["pillars"]}
    assert labels == {"valuation": "Attractive", "growth": "Moderate", "quality": "High", "momentum": "Positive"}
    assert card["red_flags"] == ["Fell 38.5% from peak within the past year"]
    assert "IT peer median" in card["pillars"][0]["points"][1]


def test_scorecard_flags_weak_company():
    snap = {**SNAPSHOT, "pe": 60.0, "roe_pct": 6.0, "debt_to_equity": 2.4, "vs_dma50_pct": -8.0, "vs_dma200_pct": -15.0}
    fin = {**FINANCIALS, "revenue_cagr_pct": 20.0, "profit_cagr_pct": 2.0, "margin_change_pp": -4.0}
    card = analysis.build_scorecard(snap, fin, PEERS)
    labels = {p["name"]: p["label"] for p in card["pillars"]}
    assert labels["valuation"] == "Expensive" and labels["quality"] == "Low" and labels["momentum"] == "Negative"
    assert any("High debt" in f for f in card["red_flags"])
    assert any("lagging revenue" in f for f in card["red_flags"])


def test_lenders_skip_margin_and_leverage_rules():
    snap = {**SNAPSHOT, "symbol": "HDFCBANK", "sector": "Financial Services", "debt_to_equity": 6.0}
    fin = {**FINANCIALS, "revenue_cagr_pct": 27.0, "profit_cagr_pct": 12.0, "margin_change_pp": -5.0}
    card = analysis.build_scorecard(snap, fin, None)
    assert not any("debt" in f.lower() or "margin" in f.lower() or "lagging" in f for f in card["red_flags"])


def test_scorecard_numbers_pass_verification():
    """Figures the model copies from the scorecard must verify against the report artifact."""
    report = {
        "kind": "report",
        "snapshot": SNAPSHOT,
        "financials": FINANCIALS,
        "peers": PEERS,
        "scorecard": analysis.build_scorecard(SNAPSHOT, FINANCIALS, PEERS),
    }
    answer = "P/E is 32.4% below its own median and ROE is 45.6%; it fell 38.5% from its peak."
    assert check(answer, [report])["unverified"] == []


@pytest.mark.parametrize(
    "question,section",
    [
        ("How is long-term capital gains on equity taxed?", "Capital gains on listed shares"),
        ("Which tax regime should I choose?", "Income-tax regimes"),
        ("Are dividends taxed?", "Dividends"),
        ("How are debt funds taxed now?", "Debt mutual funds"),
        ("PPF interest", "PPF, EPF"),
    ],
)
def test_tax_lookup(question, section):
    d = tax.get_tax_rules(question)
    assert d["sections"][0]["title"].startswith(section)
    assert d["reviewed"] and d["sources"][0]["url"].startswith("https://")


def test_tax_figures_verify_against_reference():
    d = tax.get_tax_rules("LTCG on equity")
    assert check("LTCG is taxed at 12.5% above ₹1.25 lakh; STCG at 20%.", [d])["unverified"] == []


def test_financial_year_labels():
    """Indian fiscal years end in March: Dec 2025 falls in FY26, Mar 2025 closes FY25."""
    annual = statement({"Total Revenue": [100, 90], "Net Income": [10, 9]}, ["2025-12-31", "2025-03-31"])
    years = analysis.compute_financials(annual, pd.DataFrame(), pd.Series(dtype=float), None)["annual"]
    assert [y["fy"] for y in years] == ["FY25", "FY26"]
