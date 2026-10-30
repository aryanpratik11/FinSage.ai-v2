import pytest

from backend.tools import calc, fmt, symbols


def test_sip_projection_matches_frontend_calculator():
    d = calc.project_investment("sip", 10000, 12, 15)
    assert d["invested"] == 18_00_000
    assert d["value"] == pytest.approx(50_45_760, abs=5)


def test_lumpsum_projection():
    d = calc.project_investment("lumpsum", 1_00_000, 10, 2)
    assert d["value"] == 1_21_000


def test_required_sip_round_trips():
    goal = calc.required_monthly_sip(1e7, 20, 12)
    back = calc.project_investment("sip", goal["monthly_sip"], 12, 20)
    assert back["value"] == pytest.approx(1e7, rel=0.001)


def test_invalid_projection_rejected():
    with pytest.raises(ValueError):
        calc.project_investment("sip", -5, 12, 10)


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Where should I invest ₹10,000 every month?", [10000]),
        ("I want 1 crore in 20 yrs, have 5k/month", [1e7, 5000]),
        ("2.5 lakh lumpsum", [2.5e5]),
        ("15 years at 12%", []),
    ],
)
def test_parse_amounts(text, expected):
    assert calc.parse_amounts(text) == expected


def test_inr_formatting():
    assert fmt.inr(8.96e12) == "₹8.96 lakh crore"
    assert fmt.inr(3.4e10) == "₹3,400 crore"
    assert fmt.inr(2.5e5) == "₹2.50 lakh"
    assert fmt.inr(10000) == "₹10,000"
    assert fmt.indian_grouping(12345678.9, 2) == "1,23,45,678.90"


@pytest.mark.parametrize(
    "query,symbol",
    [
        ("Infosys", "INFY"),
        ("tcs", "TCS"),
        ("HDFC Bank", "HDFCBANK"),
        ("Reliance Industries", "RELIANCE"),
        ("INFY.NS", "INFY"),
        ("nifty", "^NSEI"),
        ("zomato", "ETERNAL"),
    ],
)
def test_resolve(query, symbol):
    assert symbols.resolve(query)[0].symbol == symbol


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Should I invest in TCS?", ["TCS"]),
        ("Compare Infosys and Wipro as long-term investments", ["INFY", "WIPRO"]),
        ("Which banking stocks look strongest this quarter?", []),
        ("Is HDFC Life a good insurance stock", ["HDFCLIFE"]),
        ("IRCTC vs IRFC", ["IRCTC", "IRFC"]),
        ("what do you think about Bharat Electronics and HAL", ["BEL", "HAL"]),
        ("Is it the right time to buy gold?", []),
    ],
)
def test_extract_companies(text, expected):
    assert symbols.extract_companies(text) == expected
