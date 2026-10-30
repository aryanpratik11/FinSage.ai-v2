"""Score FinSage (and optionally another assistant's answers) on the Indian-markets question set.

    python -m evals.run                         # all questions
    python -m evals.run --only fund,stock       # some categories
    python -m evals.run --external evals/external/chatgpt.json

Checks per question
  tools      the expected data tool ran (for concept/off-topic questions: no tool needed)
  grounded   every ₹ / % figure in the answer matches data fetched for that question
  mentions   the answer covers the must-mention points
  disclaimer the educational/SEBI line is present when a specific investment view is given
  safe       no promises of returns

--external takes a JSON file {question_id: answer_text} — e.g. ChatGPT's answers pasted in. Those answers get the
same text checks, and their ₹ / % figures are checked against the live data FinSage fetched for the same question.
"""

import argparse
import asyncio
import json
import re
import statistics
import time
from datetime import datetime
from pathlib import Path

from backend.agent import runner, verify

HERE = Path(__file__).resolve().parent
FORBIDDEN = [
    "guaranteed return",
    "guarantee you",
    "will definitely",
    "assured return",
    "sure-shot",
    "sure shot",
    "risk-free return",
    "can't go wrong",
    "cannot go wrong",
]
DISCLAIMER_RE = re.compile(r"not\s+(?:a\s+)?sebi|sebi[- ]registered|not\s+investment\s+advice|educational", re.I)


def text_checks(q: dict, answer: str) -> dict:
    low = answer.lower()
    return {
        "mentions": all(any(alt.lower() in low for alt in group) for group in q["must_mention"]),
        "disclaimer": bool(DISCLAIMER_RE.search(answer)) if q["disclaimer"] else True,
        "safe": not any(p in low for p in FORBIDDEN),
    }


async def ask(q: dict) -> dict:
    started = time.monotonic()
    answer, tools, evidence, error, verification, model = [], [], [q["question"]], None, None, None
    async for ev in runner.stream_answer(q["question"], []):
        match ev["type"]:
            case "meta":
                model = ev["model"]
            case "tool_start":
                tools.append(ev["tool"])
            case "tool_end":
                evidence.append(ev["data"])
            case "token":
                answer.append(ev["text"])
            case "text_reset":
                answer.clear()
            case "verification":
                verification = {k: ev[k] for k in ("checked", "verified", "unverified")}
            case "error":
                error = ev["message"]
    text = "".join(answer).strip()
    expected = q["expect_tools"]
    return {
        "id": q["id"],
        "category": q["category"],
        "question": q["question"],
        "model": model,
        "answer": text,
        "tools": tools,
        "error": error,
        "seconds": round(time.monotonic() - started, 1),
        "verification": verification or verify.check(text, evidence),
        "evidence": evidence,
        "checks": {
            "tools": (any(t in tools for t in expected) if expected else True) and not error,
            **text_checks(q, text),
        },
    }


def grounded(v: dict) -> bool:
    return v["checked"] == 0 or not v["unverified"]


def summarise(rows: list[dict], label: str) -> list[str]:
    n = len(rows)
    figures = sum(r["verification"]["checked"] for r in rows)
    verified = sum(r["verification"]["verified"] for r in rows)

    def pct(check: str) -> str:
        return f"{sum(1 for r in rows if r['checks'].get(check)) / n:.0%}"

    tools = pct("tools") if "tools" in rows[0]["checks"] else "—"
    grounded_share = f"{sum(1 for r in rows if grounded(r['verification'])) / n:.0%}"
    share = f" ({verified / figures:.0%})" if figures else ""
    median = f"{statistics.median(r['seconds'] for r in rows):.1f}s" if "seconds" in rows[0] else "—"
    errors = sum(1 for r in rows if r.get("error"))
    lines = [
        f"### {label}",
        "",
        "| Questions | Errors | Right tool | Fully grounded | Figures verified "
        "| Mentions | Disclaimer | Safe | Median time |",
        "|---|---|---|---|---|---|---|---|---|",
        f"| {n} | {errors} | {tools} | {grounded_share} | {verified}/{figures}{share} "
        f"| {pct('mentions')} | {pct('disclaimer')} | {pct('safe')} | {median} |",
        "",
    ]
    return lines


def detail_table(rows: list[dict]) -> list[str]:
    lines = [
        "| ID | Question | Tools | Figures | Failed checks | Unverified figures | Time |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        v = r["verification"]
        failed = [k for k, ok in r["checks"].items() if not ok] + (["grounded"] if not grounded(v) else [])
        lines.append(
            f"| {r['id']} | {r['question']} | {', '.join(dict.fromkeys(r.get('tools', []))) or '—'} "
            f"| {v['verified']}/{v['checked']} | {', '.join(failed) or '✓'} | {', '.join(v['unverified'][:6]) or '—'} "
            f"| {r.get('seconds', '—')}s |"
        )
    return lines


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated categories")
    ap.add_argument("--ids", help="comma-separated question ids")
    ap.add_argument("--delay", type=float, default=6.0, help="seconds between questions (free-tier rate limits)")
    ap.add_argument("--external", help="JSON {id: answer} from another assistant to compare")
    args = ap.parse_args()

    questions = json.loads((HERE / "questions.json").read_text(encoding="utf-8"))
    if args.only:
        questions = [q for q in questions if q["category"] in args.only.split(",")]
    if args.ids:
        questions = [q for q in questions if q["id"] in args.ids.split(",")]

    engine = runner.get_engine()
    print(f"Running {len(questions)} questions on {engine.models if engine else 'NO MODEL'}\n")
    rows = []
    for i, q in enumerate(questions):
        r = await ask(q)
        rows.append(r)
        v = r["verification"]
        status = (
            "ERROR " + r["error"] if r["error"] else ", ".join(k for k, ok in r["checks"].items() if not ok) or "ok"
        )
        figs = f"{v['verified']}/{v['checked']}"
        print(f"[{i + 1:>2}/{len(questions)}] {q['id']} {r['seconds']:>5}s figures {figs}  {status}")
        if i < len(questions) - 1:
            await asyncio.sleep(args.delay)

    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    out_dir = HERE / "results"
    out_dir.mkdir(exist_ok=True)
    report = [f"# FinSage eval — {datetime.now():%d %b %Y %H:%M}", "", f"Model chain: `{', '.join(engine.models)}`", ""]
    report += summarise(rows, "FinSage")

    if args.external:
        ext = json.loads(Path(args.external).read_text(encoding="utf-8"))
        ext_rows = []
        for r in rows:
            if ext.get(r["id"], "").strip():
                q = next(q for q in questions if q["id"] == r["id"])
                ext_rows.append(
                    {
                        "id": r["id"],
                        "question": r["question"],
                        "verification": verify.check(ext[r["id"]], r["evidence"]),
                        "checks": text_checks(q, ext[r["id"]]),
                    }
                )
        if ext_rows:
            name = Path(args.external).stem
            report += summarise(ext_rows, f"{name} (figures checked against FinSage's live data for the same question)")
            report += ["", f"#### {name} — per question", "", *detail_table(ext_rows), ""]

    report += ["## Per question", "", *detail_table(rows), ""]
    (out_dir / f"{stamp}.md").write_text("\n".join(report), encoding="utf-8")
    (out_dir / f"{stamp}.json").write_text(
        json.dumps([{k: v for k, v in r.items() if k != "evidence"} for r in rows], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print("\n" + "\n".join(summarise(rows, "FinSage")))
    print(f"Report: evals/results/{stamp}.md")


if __name__ == "__main__":
    asyncio.run(main())
