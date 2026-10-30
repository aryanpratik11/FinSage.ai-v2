import json

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend import main
from backend.agent import runner
from backend.ratelimit import RateLimiter, limiter


@pytest.fixture
def client(monkeypatch):
    async def fake_stream(query, history):
        yield {"type": "meta", "mode": "guided", "model": "fake"}
        yield {"type": "token", "text": f"You asked: {query}"}
        yield {"type": "done", "elapsed_ms": 1}

    monkeypatch.setattr(runner, "stream_answer", fake_stream)
    limiter.recent.clear()
    limiter.daily.clear()
    return TestClient(main.app)  # no lifespan: skips the background news refresh


def test_stream_returns_sse_events(client):
    r = client.post("/chat/stream", json={"query": "Is TCS a buy?"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    events = [json.loads(line[6:]) for line in r.text.splitlines() if line.startswith("data: ")]
    assert [e["type"] for e in events] == ["meta", "token", "done"]


def test_non_streaming_chat(client):
    r = client.post("/chat", json={"query": "Is TCS a buy?", "history": [{"role": "user", "content": "hi"}]})
    assert r.json()["answer"] == "You asked: Is TCS a buy?"


@pytest.mark.parametrize("body", [{"query": ""}, {"query": "   "}, {"query": "x" * 5000}, {}])
def test_rejects_bad_queries(client, body):
    assert client.post("/chat/stream", json=body).status_code == 422


def test_rate_limiter():
    rl = RateLimiter(per_minute=2, per_day=3)
    rl.check("ip")
    rl.check("ip")
    with pytest.raises(HTTPException) as e:
        rl.check("ip")
    assert e.value.status_code == 429
    rl.check("other-ip")
