from backend.agent.verify import check, figures

EVIDENCE = [
    {
        "kind": "stock",
        "price": 2522.0,
        "market_cap": 8.9656e12,
        "return_1y_pct": -16.9,
        "roe_pct": 45.6,
        "chart": [["2026-01-01", 9999.0]],
    },
    {"kind": "goal", "monthly_sip": 10009, "invested": 2402160, "gains": 7597840, "target": 1e7},
    "How much SIP for ₹1 crore in 20 years?",
]


def test_rounded_figures_in_indian_units_are_verified():
    answer = (
        "Price **₹2,522**, market cap ₹8.97 lakh crore (≈ ₹9 L Cr), down −16.9%, ROE 45.6 %. "
        "SIP ₹10,009/month for ₹1 crore; invested ₹24.02 lakh, gains ₹75.98 lakh."
    )
    result = check(answer, EVIDENCE)
    assert result["unverified"] == []
    assert result["checked"] == result["verified"] == 9


def test_invented_figures_are_flagged():
    result = check("Sector median P/E is 14% below peers; expense ratio 0.70%; target ₹3,100.", EVIDENCE)
    assert result["unverified"] == ["₹3,100", "14%", "0.70%"]


def test_close_but_wrong_figure_is_flagged():
    assert check("It costs ₹9,999.", EVIDENCE)["unverified"] == ["₹9,999"]


def test_chart_points_are_not_evidence():
    assert check("It traded at ₹9,999 in January.", EVIDENCE)["unverified"] == ["₹9,999"]


def test_approximate_figures_get_more_slack():
    assert check("Market cap is about ₹9.1 lakh crore.", EVIDENCE)["unverified"] == []
    assert check("Market cap is ₹9.1 lakh crore.", EVIDENCE)["unverified"] == ["₹9.1 lakh crore"]


def test_parses_rupee_spellings():
    values = [f.value for f in figures("Rs. 5 lakh, INR 2.5 cr, ₹10k and 1.5 crore")]
    assert values == [5e5, 2.5e7, 1e4]  # "1.5 crore" without ₹ isn't a money figure


def test_no_figures():
    assert check("Index funds suit beginners.", EVIDENCE) == {"checked": 0, "verified": 0, "unverified": []}
