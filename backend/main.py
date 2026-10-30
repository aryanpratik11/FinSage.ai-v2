import asyncio
import json
import logging
from contextlib import asynccontextmanager, suppress
from typing import Literal

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from backend import config
from backend.agent import runner
from backend.ratelimit import rate_limit
from backend.tools import http, news, symbols

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("finsage")


async def _news_loop():
    while True:
        try:
            await news.store.refresh()
        except Exception:
            log.exception("News refresh failed")
        await asyncio.sleep(config.NEWS_REFRESH_MINUTES * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    symbols.all_listings()  # load the NSE list once at startup
    runner.get_engine()
    task = asyncio.create_task(_news_loop())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
    await http.close()


app = FastAPI(
    title="FinSage AI",
    version="2.0",
    description="AI research assistant for Indian investors: NSE/BSE stocks, mutual funds and personal finance.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_origin_regex=config.ALLOWED_ORIGIN_REGEX,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=6000)


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=config.MAX_QUERY_CHARS)
    history: list[ChatTurn] = Field(default_factory=list, max_length=40)

    @field_validator("query")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Query cannot be empty.")
        return v.strip()


async def _sse(events, ping_seconds: int = 15):
    """Serialise events as SSE, with keep-alive comments so proxies don't drop slow requests."""
    queue: asyncio.Queue = asyncio.Queue()

    async def produce():
        try:
            async for ev in events:
                await queue.put(ev)
        finally:
            await queue.put(None)

    task = asyncio.create_task(produce())
    try:
        while True:
            try:
                ev = await asyncio.wait_for(queue.get(), timeout=ping_seconds)
            except TimeoutError:
                yield ": ping\n\n"
                continue
            if ev is None:
                break
            yield f"data: {json.dumps(ev, ensure_ascii=False, default=str)}\n\n"
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


@app.post("/chat/stream", dependencies=[Depends(rate_limit)], tags=["Chat"])
async def chat_stream(req: ChatRequest):
    """Stream an answer as server-sent events (see backend/agent/runner.py for the event types)."""
    history = [t.model_dump() for t in req.history]
    return StreamingResponse(
        _sse(runner.stream_answer(req.query, history)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/chat", dependencies=[Depends(rate_limit)], tags=["Chat"])
async def chat(req: ChatRequest):
    """Non-streaming variant: waits for the full answer."""
    answer, tools, error, meta, verification = [], [], None, {}, None
    async for ev in runner.stream_answer(req.query, [t.model_dump() for t in req.history]):
        match ev["type"]:
            case "meta":
                meta = ev
            case "token":
                answer.append(ev["text"])
            case "text_reset":
                answer.clear()
            case "tool_end":
                tools.append({"tool": ev["tool"], "ok": ev["ok"], "data": ev["data"]})
            case "verification":
                verification = {k: ev[k] for k in ("checked", "verified", "unverified")}
            case "error":
                error = ev["message"]
    return {
        "answer": "".join(answer).strip(),
        "tools": tools,
        "verification": verification,
        "mode": meta.get("mode"),
        "model": meta.get("model"),
        "error": error,
    }


@app.get("/health", tags=["System"])
async def health():
    engine = runner.get_engine()
    return {
        "status": "ok" if engine else "no_model",
        "mode": engine.mode if engine else None,
        "models": engine.models if engine else [],
        "news_items": len(news.store.items),
    }


@app.get("/", tags=["System"])
async def root():
    return {"name": "FinSage AI", "docs": "/docs", "health": "/health"}
