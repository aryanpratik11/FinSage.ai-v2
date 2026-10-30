"""Formatting helpers for text handed to the LLM (Indian lakh/crore conventions)."""

import math


def num(value) -> float | None:
    """Coerce to a finite float, else None."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def inr(value: float | None, decimals: int | None = None) -> str:
    """₹ amount in words-style units: ₹8.97 lakh crore, ₹3,412 crore, ₹12.5 lakh, ₹2,478.50."""
    v = num(value)
    if v is None:
        return "n/a"
    sign, v = ("-" if v < 0 else ""), abs(v)
    if v >= 1e12:
        return f"{sign}₹{v / 1e12:.2f} lakh crore"
    if v >= 1e7:
        return f"{sign}₹{v / 1e7:,.0f} crore" if v >= 1e9 else f"{sign}₹{v / 1e7:.2f} crore"
    if v >= 1e5:
        return f"{sign}₹{v / 1e5:.2f} lakh"
    if decimals is None:
        decimals = 0 if v >= 100 or v.is_integer() else 2
    return f"{sign}₹{indian_grouping(v, decimals)}"


def indian_grouping(value: float, decimals: int = 0) -> str:
    """12345678.9 -> '1,23,45,678.90' (Indian digit grouping)."""
    whole, _, frac = f"{abs(value):.{decimals}f}".partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    out = f"{whole}.{frac}" if frac else whole
    return f"-{out}" if value < 0 else out


def pct(value: float | None, decimals: int = 1, signed: bool = False) -> str:
    v = num(value)
    if v is None:
        return "n/a"
    return f"{v:+.{decimals}f}%" if signed else f"{v:.{decimals}f}%"


def ratio(value: float | None, decimals: int = 2) -> str:
    v = num(value)
    return "n/a" if v is None else f"{v:.{decimals}f}"


def downsample(points: list, target: int = 60) -> list:
    """Evenly thin a series for charts, always keeping the last point."""
    if len(points) <= target:
        return points
    step = len(points) / target
    out = [points[int(i * step)] for i in range(target - 1)]
    out.append(points[-1])
    return out
