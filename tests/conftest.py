import json

import pytest
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult


class ScriptedModel(BaseChatModel):
    """Replays a fixed list of AIMessages; streams text word by word and tool calls as one chunk."""

    script: list
    calls: int = 0

    @property
    def _llm_type(self) -> str:
        return "scripted"

    def bind_tools(self, tools, **kwargs):
        return self

    def _next(self) -> AIMessage:
        msg = self.script[min(self.calls, len(self.script) - 1)]
        self.calls += 1
        return msg

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        return ChatResult(generations=[ChatGeneration(message=self._next())])

    def _stream(self, messages, stop=None, run_manager=None, **kwargs):
        msg = self._next()
        if msg.tool_calls:
            yield ChatGenerationChunk(
                message=AIMessageChunk(
                    content=msg.content,
                    tool_call_chunks=[
                        {"name": tc["name"], "args": json.dumps(tc["args"]), "id": tc["id"], "index": i}
                        for i, tc in enumerate(msg.tool_calls)
                    ],
                )
            )
            return
        for word in msg.content.split(" "):
            chunk = ChatGenerationChunk(message=AIMessageChunk(content=word + " "))
            if run_manager:
                run_manager.on_llm_new_token(chunk.text, chunk=chunk)
            yield chunk


@pytest.fixture
def scripted():
    return ScriptedModel


@pytest.fixture
def no_news(monkeypatch):
    from backend.tools import news

    async def search(query, limit=6, keywords=None):
        return {"kind": "news", "query": query, "items": [], "sources": []}

    monkeypatch.setattr(news, "search_news", search)


@pytest.fixture
def fake_snapshot(monkeypatch):
    from backend.tools import market

    async def snapshot(name_or_symbol: str) -> dict:
        return {
            "kind": "stock",
            "symbol": "TCS",
            "ticker": "TCS.NS",
            "exchange": "NSE",
            "name": "Tata Consultancy Services Limited",
            "sector": "Technology",
            "industry": "IT Services",
            "price": 2478.0,
            "change_pct": 0.7,
            "return_1y_pct": -19.0,
            "low_52w": 1976.8,
            "high_52w": 3350.0,
            "market_cap": 8.97e12,
            "pe": 17.4,
            "forward_pe": 16.0,
            "pb": 7.5,
            "eps": 140.0,
            "roe_pct": 45.6,
            "debt_to_equity": 0.1,
            "dividend_yield_pct": 1.95,
            "profit_margin_pct": 19.0,
            "revenue_growth_pct": 4.0,
            "as_of": "2026-10-29",
            "chart": [],
            "sources": [],
        }

    from backend.tools import analysis

    monkeypatch.setattr(market, "get_stock_snapshot", snapshot)
    monkeypatch.setattr(analysis, "get_stock_report", snapshot)  # a plain snapshot is a valid report for an index
    return snapshot
