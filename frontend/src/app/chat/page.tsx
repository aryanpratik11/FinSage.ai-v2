"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Calculator, Cpu, History, Landmark, Menu, PiggyBank, Plus, Square, TrendingUp, Trash2, X } from "lucide-react";
import { Logo, SageMark } from "@/components/Logo";
import { AssistantMessage, type AssistantMsg } from "@/components/AssistantMessage";
import { streamChat, checkHealth, API_URL, type ChatTurn, type Health, type StreamEvent } from "@/lib/api";

type Message = { id: string; role: "user"; text: string } | AssistantMsg;

const SUGGESTIONS = [
  { icon: TrendingUp, tag: "Stock analysis", text: "Should I invest in TCS right now?" },
  { icon: Landmark, tag: "Sector", text: "Which banking stocks look strongest this quarter?" },
  { icon: Cpu, tag: "Comparison", text: "Compare Infosys and Wipro as long-term investments" },
  { icon: PiggyBank, tag: "Mutual funds", text: "How has Parag Parikh Flexi Cap performed?" },
];

const HISTORY_KEY = "finsage:recent";
const MAX_TURNS = 8;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {}
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Conversation so far as user/assistant turns, for follow-up questions. */
function toTurns(messages: Message[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const m of messages) {
    if (m.role === "user") turns.push({ role: "user", content: m.text });
    else if (m.status === "done" && m.text) turns.push({ role: "assistant", content: m.text });
    else turns.pop(); // drop the question of a failed answer
  }
  return turns.slice(-MAX_TURNS);
}

function StatusPill({ health }: { health: Health | null | undefined }) {
  const pending = health === undefined;
  const ok = !!health && health.status === "ok";
  let label = "Connecting…";
  if (!pending) {
    if (!health) label = "Engine offline";
    else if (!ok) label = "No AI model configured";
    else if (health.mode === "tools") label = `Live tools · ${health.models[0]?.split(":")[0]}`;
    else label = "Local model · guided mode";
  }
  const dot = pending ? "bg-gold-400" : ok ? "bg-brand-400" : "bg-red-400";
  return (
    <span className="flex items-center gap-2 text-xs text-white/60" title={health?.models.join(", ")}>
      <span className="relative flex h-2 w-2">
        {ok && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dot}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {label}
    </span>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [health, setHealth] = useState<Health | null | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const busy = messages.some((m) => m.role === "assistant" && m.status === "streaming");

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setHistory(loadHistory());
    checkHealth().then(setHealth);
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const run = useCallback(async (query: string, replaceId?: string) => {
    const assistantId = replaceId ?? uid();
    const controller = new AbortController();
    abortRef.current = controller;

    // Earlier turns only: on retry, everything before the failed question.
    const current = messagesRef.current;
    const before = replaceId ? current.slice(0, Math.max(0, current.findIndex((m) => m.id === replaceId) - 1)) : current;
    const turns = toTurns(before);

    const fresh: AssistantMsg = { id: assistantId, role: "assistant", query, status: "streaming", text: "", steps: [], data: [] };
    setMessages((prev) =>
      replaceId ? prev.map((m) => (m.id === replaceId ? fresh : m)) : [...prev, { id: uid(), role: "user", text: query }, fresh],
    );

    const update = (fn: (m: AssistantMsg) => AssistantMsg) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantId && m.role === "assistant" ? fn(m) : m)));

    const onEvent = (ev: StreamEvent) => {
      switch (ev.type) {
        case "meta":
          update((m) => ({ ...m, model: ev.model }));
          break;
        case "tool_start":
          update((m) => ({ ...m, steps: [...m.steps, { id: ev.id, tool: ev.tool, input: ev.input, status: "running" }] }));
          break;
        case "tool_end":
          update((m) => ({
            ...m,
            steps: m.steps.map((s) =>
              s.id === ev.id
                ? { ...s, status: ev.ok ? "done" : "failed", error: ev.data.kind === "error" ? ev.data.message : undefined }
                : s,
            ),
            data: ev.ok ? [...m.data, ev.data] : m.data,
          }));
          break;
        case "token":
          update((m) => ({ ...m, text: m.text + ev.text }));
          break;
        case "text_reset":
          update((m) => ({ ...m, text: "" }));
          break;
        case "verification":
          update((m) => ({ ...m, verification: { checked: ev.checked, verified: ev.verified, unverified: ev.unverified } }));
          break;
        case "done":
          update((m) => ({ ...m, status: "done", elapsedMs: ev.elapsed_ms }));
          break;
        case "error":
          update((m) => ({ ...m, status: "error", error: ev.message }));
          break;
      }
    };

    try {
      await streamChat(query, turns, onEvent, controller.signal);
      update((m) => {
        if (m.status !== "streaming") return m;
        return m.text ? { ...m, status: "done" } : { ...m, status: "error", error: "The connection closed before an answer arrived." };
      });
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      const network = e instanceof TypeError;
      if (network) setHealth(null);
      const error = aborted
        ? "You stopped this request."
        : network
          ? `Couldn't reach the FinSage backend at ${API_URL}. Make sure the API server is running.`
          : (e as Error).message || "Something went wrong.";
      update((m) => ({ ...m, status: "error", error }));
    } finally {
      abortRef.current = null;
    }
  }, []);

  const send = (text: string) => {
    const query = text.trim();
    if (!query || busy) return;
    setInput("");
    setSidebarOpen(false);
    const next = [query, ...history.filter((h) => h !== query)].slice(0, 15);
    setHistory(next);
    saveHistory(next);
    run(query);
  };

  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f6faf7]">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-forest-950/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-forest-950 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Logo dark className="h-11" />
          <button onClick={() => setSidebarOpen(false)} className="text-white/60 lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4">
          <button
            onClick={newChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-forest-950 transition hover:bg-brand-400"
          >
            <Plus className="h-4 w-4" /> New research
          </button>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto px-4">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/35">
              <History className="h-3.5 w-3.5" /> Recent
            </span>
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-white/30 transition hover:text-white/70" aria-label="Clear recent">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="px-2 text-xs leading-5 text-white/30">Your recent questions will appear here.</p>
          ) : (
            <ul className="space-y-0.5">
              {history.map((h) => (
                <li key={h}>
                  <button
                    onClick={() => send(h)}
                    disabled={busy}
                    className="w-full truncate rounded-lg px-2 py-2 text-left text-sm text-white/65 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                    title={h}
                  >
                    {h}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4 border-t border-white/5 p-4">
          <Link
            href="/#sip-calculator"
            className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/5 transition hover:bg-white/[0.08]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
              <Calculator className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">SIP calculator</span>
              <span className="block text-xs text-white/45">Project your ₹ growth</span>
            </span>
          </Link>
          <div className="px-1">
            <StatusPill health={health} />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-forest-900/5 bg-white/70 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-forest-900" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">FinSage</span>
          <button onClick={newChat} className="ml-auto rounded-lg p-1.5 text-forest-900" aria-label="New research">
            <Plus className="h-5 w-5" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-6">
              <SageMark className="h-16 w-16 rounded-2xl" />
              <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
                Namaste! <span className="text-forest-800/40">What shall we research?</span>
              </h1>
              <p className="mt-3 max-w-lg text-forest-800/60">
                Ask about any NSE/BSE stock, sector, mutual fund or savings goal. FinSage reads the news, checks the
                numbers and explains the risks.
              </p>
              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => send(s.text)}
                    className="group flex items-start gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-forest-900/5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-900/5 hover:ring-brand-200"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                      <s.icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-brand-700">{s.tag}</span>
                      <span className="mt-0.5 block text-sm font-medium text-forest-900">{s.text}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] animate-fade-up rounded-2xl rounded-br-md bg-forest-900 px-4 py-3 text-[15px] text-white shadow-sm">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-3">
                    <SageMark className="mt-1 h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <AssistantMessage msg={m} onRetry={() => run(m.query, m.id)} retryDisabled={busy} />
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="bg-gradient-to-t from-[#f6faf7] via-[#f6faf7] to-transparent px-4 pt-2 pb-4 sm:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl bg-white p-2 shadow-lg shadow-forest-900/5 ring-1 ring-forest-900/10 transition focus-within:ring-2 focus-within:ring-brand-400"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask about a stock, sector or how to invest your ₹…"
              className="max-h-[180px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-forest-800/40"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest-900 text-white transition hover:bg-forest-800"
                aria-label="Stop"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:bg-forest-900/10 disabled:text-forest-800/40"
                aria-label="Send"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-forest-800/45">
            AI-generated research, not investment advice. Investments are subject to market risks.
          </p>
        </div>
      </main>
    </div>
  );
}
