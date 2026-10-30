"""LangGraph graphs.

tools  — the LLM decides which tools to call (needs a model with reliable tool calling, e.g. Qwen3.8 27B on Groq).
guided — Python picks the tools (router.py), the LLM only writes the answer (works with small local models).
"""

import asyncio

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from backend.agent import router
from backend.agent.lc_tools import TOOLS_BY_NAME

MAX_CONTEXT_CHARS_PER_TOOL = 1600


def build_tools_graph(model_with_tools, final_model, tools, max_tool_rounds: int):
    async def prefetch(state: MessagesState):
        # Models sometimes answer about a named stock or fund from memory, with made-up numbers.
        # When the router recognises the question, fetch that data up front; the model can still call more tools.
        users = [m.content for m in state["messages"] if isinstance(m, HumanMessage)]
        calls = router.plan(users[-1], users[:-1])
        if not calls:
            return {"messages": []}
        return {
            "messages": [
                AIMessage("", tool_calls=[{"name": c["name"], "args": c["args"], "id": c["id"]} for c in calls])
            ]
        }

    async def agent(state: MessagesState, config: RunnableConfig):
        rounds = sum(1 for m in state["messages"] if isinstance(m, AIMessage) and m.tool_calls)
        model = model_with_tools if rounds < max_tool_rounds else final_model
        return {"messages": [await model.ainvoke(state["messages"], config)]}

    g = StateGraph(MessagesState)
    g.add_node("prefetch", prefetch)
    g.add_node("agent", agent)
    g.add_node("tools", ToolNode(tools))
    g.add_edge(START, "prefetch")
    g.add_conditional_edges("prefetch", tools_condition, {"tools": "tools", END: "agent"})
    g.add_conditional_edges("agent", tools_condition)
    g.add_edge("tools", "agent")
    return g.compile()


class GuidedState(MessagesState):
    calls: list[dict]
    context: str


def build_guided_graph(model):
    def latest_question(state) -> str:
        return next(m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage))

    async def plan(state: GuidedState):
        users = [m.content for m in state["messages"] if isinstance(m, HumanMessage)]
        return {"calls": router.plan(users[-1], users[:-1])}

    async def gather(state: GuidedState, config: RunnableConfig):
        results = await asyncio.gather(
            *(TOOLS_BY_NAME[c["name"]].ainvoke(c, config) for c in state["calls"]),
            return_exceptions=True,
        )
        parts = []
        for call, result in zip(state["calls"], results, strict=True):
            text = result.content if isinstance(result, ToolMessage) else f"Tool error: {result}"
            parts.append(f"[{call['name']}]\n{text[:MAX_CONTEXT_CHARS_PER_TOOL]}")
        return {"context": "\n\n".join(parts)}

    async def respond(state: GuidedState, config: RunnableConfig):
        messages = list(state["messages"])
        if state.get("context"):
            question = latest_question(state)
            messages[-1] = HumanMessage(f"{question}\n\nDATA (fetched just now):\n{state['context']}")
        return {"messages": [await model.ainvoke(messages, config)]}

    g = StateGraph(GuidedState)
    g.add_node("plan", plan)
    g.add_node("gather", gather)
    g.add_node("respond", respond)
    g.add_edge(START, "plan")
    g.add_conditional_edges("plan", lambda s: "gather" if s["calls"] else "respond", ["gather", "respond"])
    g.add_edge("gather", "respond")
    g.add_edge("respond", END)
    return g.compile()
