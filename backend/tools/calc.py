"""Deterministic investment maths — the LLM explains these numbers, it never computes them."""

import re

from backend.tools import fmt


def project_investment(mode: str, amount: float, annual_return_pct: float, years: int) -> dict:
    """Future value of a monthly SIP (start-of-month contributions) or a one-time lumpsum."""
    mode = "lumpsum" if mode.lower().startswith("lump") else "sip"
    if amount <= 0 or years <= 0 or years > 60 or not (-50 < annual_return_pct < 100):
        raise ValueError("Amount and years must be positive, years ≤ 60, and the return between -50% and 100%.")

    i = annual_return_pct / 100 / 12
    rows = []
    for y in range(1, int(years) + 1):
        n = y * 12
        if mode == "sip":
            value = amount * n if i == 0 else amount * ((1 + i) ** n - 1) / i * (1 + i)
            invested = amount * n
        else:
            value = amount * (1 + annual_return_pct / 100) ** y
            invested = amount
        rows.append({"year": y, "invested": round(invested), "value": round(value)})

    last = rows[-1]
    return {
        "kind": "projection",
        "mode": mode,
        "amount": amount,
        "annual_return_pct": annual_return_pct,
        "years": int(years),
        "invested": last["invested"],
        "value": last["value"],
        "gains": last["value"] - last["invested"],
        "multiple": round(last["value"] / last["invested"], 2),
        "yearly": rows,
    }


def required_monthly_sip(target_amount: float, years: int, annual_return_pct: float) -> dict:
    if target_amount <= 0 or years <= 0 or years > 60:
        raise ValueError("Target must be positive and years between 1 and 60.")
    i, n = annual_return_pct / 100 / 12, int(years) * 12
    factor = n if i == 0 else ((1 + i) ** n - 1) / i * (1 + i)
    monthly = target_amount / factor
    return {
        "kind": "goal",
        "target": target_amount,
        "years": int(years),
        "annual_return_pct": annual_return_pct,
        "monthly_sip": round(monthly),
        "invested": round(monthly * n),
        "gains": round(target_amount - monthly * n),
    }


def projection_text(d: dict) -> str:
    what = (
        f"Monthly SIP of {fmt.inr(d['amount'])}"
        if d["mode"] == "sip"
        else f"One-time investment of {fmt.inr(d['amount'])}"
    )
    return (
        f"{what} for {d['years']} years at an assumed {d['annual_return_pct']}% annual return:\n"
        f"Total invested: {fmt.inr(d['invested'])}; Estimated value: {fmt.inr(d['value'])}; "
        f"Estimated gains: {fmt.inr(d['gains'])} ({d['multiple']}× the money invested).\n"
        "This assumes a constant return; real market returns vary year to year and are not guaranteed."
    )


def goal_text(d: dict) -> str:
    return (
        f"To reach {fmt.inr(d['target'])} in {d['years']} years at an assumed {d['annual_return_pct']}% annual return, "
        f"a monthly SIP of about {fmt.inr(d['monthly_sip'])} is needed. "
        f"Total invested: {fmt.inr(d['invested'])}; estimated gains: {fmt.inr(d['gains'])}. "
        "Assumes a constant return; actual returns vary."
    )


# ── Parsing amounts in Indian notation (used by the guided router) ─────────────
_UNITS = {
    "k": 1e3,
    "thousand": 1e3,
    "l": 1e5,
    "lac": 1e5,
    "lacs": 1e5,
    "lakh": 1e5,
    "lakhs": 1e5,
    "cr": 1e7,
    "crore": 1e7,
    "crores": 1e7,
}
AMOUNT_RE = re.compile(
    r"(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|l|crores?|cr)?\b",
    re.I,
)


def parse_amounts(text: str) -> list[float]:
    """All rupee amounts in the text: '₹10,000', '10k', '1.5 lakh', '2 cr'. Skips bare years/percentages."""
    out = []
    for m in AMOUNT_RE.finditer(text):
        number, unit = m.group(1), (m.group(2) or "").lower()
        tail = text[m.end() : m.end() + 8].lower()
        has_rupee = bool(re.match(r"(₹|rs|inr)", m.group(0).strip(), re.I))
        if (
            not unit
            and not has_rupee
            and (
                re.match(r"\s*(%|percent|years?|yrs?|months?)", tail)
                or "," not in number
                and float(number.replace(",", "")) < 1000
            )
        ):
            continue
        out.append(float(number.replace(",", "")) * _UNITS.get(unit, 1))
    return out


def parse_years(text: str) -> int | None:
    m = re.search(r"(\d{1,2})\s*(?:years?|yrs?|yr)\b", text, re.I)
    return int(m.group(1)) if m else None


def parse_rate(text: str) -> float | None:
    m = re.search(r"(\d{1,2}(?:\.\d+)?)\s*(?:%|percent)", text, re.I)
    return float(m.group(1)) if m else None
