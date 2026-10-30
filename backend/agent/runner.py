"""Runs a question through the graph and yields UI events:

meta        {mode, model}
tool_start  {id, tool, input}
tool_end    {id, tool, ok, data}
token       {text}
text_reset  {}             (the model wrote text, then decided to call tools — discard it)
verification {checked, verified, unverified}   (₹ / % figures in the answer vs fetched data)
done        {elapsed_ms}
error       {message}
"""

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from functools import lru_cache

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend import config
from backend.agent import llm, prompts, verify
from backend.agent.graph import build_guided_graph, build_tools_graph
from backend.agent.lc_tools import TOOLS

log = logging.getLogger(__name__)

ANSWER_NODES = {"agent", "respond"}


@dataclass
class Engine:
    graph: object
    mode: str
    models: list[str]

    def system_prompt(self) -> str:
        return prompts.tools_system_prompt() if self.mode == "tools" else prompts.guided_system_prompt()


@lru_cache(maxsize=1)
def get_engine() -> Engine | None:
    providers = llm.available_providers()
    if not providers:
        return None
    hosted = [p for p in providers if p.hosted]
    mode = config.AGENT_MODE if config.AGENT_MODE in ("tools", "guided") else ("tools" if hosted else "guided")

    if mode == "tools":
        chain = hosted or providers
        models = [llm.chat_model(p) for p in chain]
        graph = build_tools_graph(
            llm.with_fallbacks([m.bind_tools(TOOLS) for m in models]),
            llm.with_fallbacks([m.bind_tools(TOOLS, tool_choice="none") for m in models]),
            TOOLS,
            config.MAX_TOOL_ROUNDS,
        )
    else:
        chain = providers
        graph = build_guided_graph(llm.with_fallbacks([llm.chat_model(p, max_tokens=700) for p in chain]))

    names = [f"{p.name}:{p.model}" for p in chain]
    log.info("Engine ready: mode=%s models=%s", mode, names)
    return Engine(graph, mode, names)


def _tool_input(raw) -> dict:
    if isinstance(raw, dict) and isinstance(raw.get("args"), dict):
        return raw["args"]
    return raw if isinstance(raw, dict) else {"input": str(raw)}


async def stream_answer(query: str, history: list[dict]) -> AsyncIterator[dict]:
    engine = get_engine()
    if engine is None:
        yield {
            "type": "error",
            "message": "No language model is configured on the server. "
            "Add GROQ_API_KEY or GEMINI_API_KEY, or start a local model.",
        }
        return

    started = time.monotonic()
    yield {"type": "meta", "mode": engine.mode, "model": engine.models[0]}

    messages = [SystemMessage(engine.system_prompt())]
    for turn in history[-config.MAX_HISTORY_MESSAGES :]:
        content = turn["content"][:1500]
        messages.append(HumanMessage(content) if turn["role"] == "user" else AIMessage(content))
    messages.append(HumanMessage(query))

    streamed_runs: set[str] = set()
    tools_used = []
    answer: list[str] = []
    evidence: list = [query, *(t["content"] for t in history)]
    try:
        async with asyncio.timeout(config.REQUEST_TIMEOUT_SECONDS):
            async for ev in engine.graph.astream_events(
                {"messages": messages}, config={"recursion_limit": 14}, version="v2"
            ):
                kind, run_id = ev["event"], ev.get("run_id")
                node = (ev.get("metadata") or {}).get("langgraph_node")

                if kind == "on_tool_start":
                    tools_used.append(ev["name"])
                    yield {
                        "type": "tool_start",
                        "id": run_id,
                        "tool": ev["name"],
                        "input": _tool_input(ev["data"].get("input")),
                    }

                elif kind == "on_tool_end":
                    out = ev["data"].get("output")
                    artifact = getattr(out, "artifact", None) or {}
                    evidence.append(artifact)
                    yield {
                        "type": "tool_end",
                        "id": run_id,
                        "tool": ev["name"],
                        "ok": artifact.get("kind") not in (None, "error"),
                        "data": artifact,
                    }

                elif kind == "on_chat_model_stream" and node in ANSWER_NODES:
                    text = ev["data"]["chunk"].content
                    if isinstance(text, str) and text:
                        streamed_runs.add(run_id)
                        answer.append(text)
                        yield {"type": "token", "text": text}

                elif kind == "on_chat_model_end" and node == "agent":
                    output = ev["data"].get("output")
                    if getattr(output, "tool_calls", None) and run_id in streamed_runs:
                        answer.clear()
                        yield {"type": "text_reset"}
    except TimeoutError:
        yield {
            "type": "error",
            "message": "This is taking too long — the data sources or the model are slow right now. Please try again.",
        }
        return
    except Exception as e:
        log.exception("Agent run failed")
        yield {"type": "error", "message": _friendly(e)}
        return

    checked = verify.check("".join(answer), evidence)
    yield {"type": "verification", **checked}

    elapsed = round((time.monotonic() - started) * 1000)
    log.info(
        "Answered in %dms mode=%s tools=%s figures=%d/%d unverified=%s",
        elapsed,
        engine.mode,
        tools_used,
        checked["verified"],
        checked["checked"],
        checked["unverified"],
    )
    yield {"type": "done", "elapsed_ms": elapsed}


def _friendly(e: Exception) -> str:
    text = f"{type(e).__name__}: {e}".lower()
    if "rate" in text and "limit" in text or "429" in text:
        return "The AI model's free quota is used up for the moment. Please try again in a minute."
    if "connect" in text or "connection" in text:
        return "Couldn't reach the AI model server. If you're running locally, make sure the model server is up."
    return "Something went wrong while researching this. Please try again."
