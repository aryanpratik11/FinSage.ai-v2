import pytest
from langchain_core.messages import AIMessage

from backend.agent import router, runner
from backend.agent.graph import build_guided_graph, build_tools_graph
from backend.agent.lc_tools import TOOLS


def names(calls):
    return [c["name"] for c in calls]


@pytest.mark.parametrize(
    "query,expected",
    [
        ("Should I invest in TCS right now?", ["get_stock_snapshot", "search_news"]),
        ("Which banking stocks look strongest this quarter?", ["list_sector_stocks", "search_news"]),
        ("Compare Infosys and Wipro", ["compare_stocks", "search_news"]),
        ("How much SIP do I need to build ₹1 crore in 20 years?", ["required_monthly_sip"]),
        ("I have 5 lakh lumpsum for 10 years, what will it become at 11%?", ["investment_projection"]),
        ("Parag Parikh flexi cap fund returns", ["get_mutual_fund"]),
        ("best large cap mutual fund for SIP", []),
        ("What is LTCG tax on equity?", []),
    ],
)
def test_router_plans(query, expected):
    assert names(router.plan(query)) == expected


def test_router_follow_up_uses_previous_company():
    calls = router.plan("what about its debt?", ["Should I invest in TCS?"])
    assert calls[0]["args"]["name_or_symbol"] == "TCS"


async def collect(engine, query="Should I buy TCS?"):
    runner.get_engine.cache_clear()
    original = runner.get_engine
    runner.get_engine = lambda: engine
    try:
        return [ev async for ev in runner.stream_answer(query, [])]
    finally:
        runner.get_engine = original


async def test_tools_graph_streams_tool_events_and_answer(scripted, fake_snapshot, no_news):
    model = scripted(
        script=[
            AIMessage(
                "Let me check.",
                tool_calls=[{"name": "get_stock_snapshot", "args": {"name_or_symbol": "TCS"}, "id": "c1"}],
            ),
            AIMessage("TCS trades at **₹2,478** with a P/E of 17.4."),
        ]
    )
    graph = build_tools_graph(model, model, TOOLS, max_tool_rounds=3)
    events = await collect(runner.Engine(graph, "tools", ["fake"]))
    kinds = [e["type"] for e in events]

    assert kinds[0] == "meta" and kinds[-1] == "done"
    assert "text_reset" in kinds  # the "Let me check." preamble is discarded
    tool_end = next(e for e in events if e["type"] == "tool_end")
    assert tool_end["ok"] and tool_end["data"]["symbol"] == "TCS"
    after_reset = kinds.index("text_reset")
    answer = "".join(e["text"] for e in events[after_reset:] if e["type"] == "token")
    assert "₹2,478" in answer
    verification = next(e for e in events if e["type"] == "verification")
    assert verification == {"type": "verification", "checked": 1, "verified": 1, "unverified": []}


async def test_tools_graph_prefetches_data_the_model_skipped(scripted, monkeypatch):
    """A model that answers without calling tools still gets the fund's real data first."""
    from backend.tools import funds

    async def fund(name_or_code, plan="direct"):
        return {
            "kind": "fund",
            "name": "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
            "code": 122639,
            "nav": 88.8,
            "nav_date": "2026-10-28",
            "returns": {"1y": -7.0, "3y": 12.5, "5y": 10.8, "inception": 17.7},
            "inception_date": "2013-05-28",
            "category": "Flexi Cap",
            "fund_house": "PPFAS",
            "chart": [],
            "sources": [],
        }

    monkeypatch.setattr(funds, "get_mutual_fund", fund)
    model = scripted(script=[AIMessage("The fund returned -7.0% over 1 year, versus 22.4% you may have read.")])
    graph = build_tools_graph(model, model, TOOLS, max_tool_rounds=3)
    events = await collect(runner.Engine(graph, "tools", ["fake"]), "How has Parag Parikh Flexi Cap performed?")

    tool_end = next(e for e in events if e["type"] == "tool_end")
    assert tool_end["tool"] == "get_mutual_fund" and tool_end["data"]["nav"] == 88.8
    assert model.calls == 1  # the model wrote once, after the data was in context
    verification = next(e for e in events if e["type"] == "verification")
    assert verification["unverified"] == ["22.4%"]


async def test_guided_graph_feeds_data_to_model(scripted, fake_snapshot, no_news):
    model = scripted(script=[AIMessage("TCS looks fairly valued.")])
    events = await collect(runner.Engine(build_guided_graph(model), "guided", ["fake"]))

    tools = [e["tool"] for e in events if e["type"] == "tool_end"]
    assert sorted(tools) == ["get_stock_snapshot", "search_news"]
    assert "".join(e["text"] for e in events if e["type"] == "token").strip() == "TCS looks fairly valued."


async def test_tool_errors_are_reported_not_raised(scripted, monkeypatch):
    from backend.tools import market

    async def boom(name_or_symbol):
        raise LookupError("Couldn't find an NSE-listed company matching 'XYZ'.")

    monkeypatch.setattr(market, "get_stock_snapshot", boom)
    model = scripted(
        script=[
            AIMessage("", tool_calls=[{"name": "get_stock_snapshot", "args": {"name_or_symbol": "XYZ"}, "id": "c1"}]),
            AIMessage("I couldn't find that company."),
        ]
    )
    events = await collect(runner.Engine(build_tools_graph(model, model, TOOLS, 3), "tools", ["fake"]))
    tool_end = next(e for e in events if e["type"] == "tool_end")
    assert tool_end["ok"] is False and "XYZ" in tool_end["data"]["message"]
    assert events[-1]["type"] == "done"
