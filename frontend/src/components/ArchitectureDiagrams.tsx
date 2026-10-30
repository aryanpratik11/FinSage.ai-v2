import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Calculator,
  CircleCheck,
  Database,
  Globe,
  Hash,
  Landmark,
  MessageSquareText,
  Newspaper,
  PiggyBank,
  Radio,
  Route,
  Search,
  Server,
  ShieldCheck,
  Wrench,
} from "lucide-react";

/* ─────────────────────────── System architecture ─────────────────────────── */

const LAYERS = [
  {
    icon: Globe,
    name: "Web app",
    tech: "Next.js 16 · Tailwind",
    tone: "bg-white ring-forest-900/10",
    items: ["Research chat", "Live tool steps", "Stock, fund & SIP cards", "SIP calculator"],
  },
  {
    icon: Server,
    name: "API",
    tech: "FastAPI",
    tone: "bg-white ring-forest-900/10",
    items: ["/chat/stream (SSE)", "Input validation", "Per-user rate limits", "News refresher · 10 min"],
  },
  {
    icon: BrainCircuit,
    name: "Agent",
    tech: "LangGraph",
    tone: "bg-forest-900 ring-forest-900 text-white",
    items: ["Router", "Data prefetch", "Tool-calling LLM", "Figure verifier"],
  },
  {
    icon: Wrench,
    name: "Tools",
    tech: "Plain Python",
    tone: "bg-white ring-forest-900/10",
    items: ["market.py", "funds.py", "news.py", "calc.py", "symbols.py"],
  },
  {
    icon: Database,
    name: "Data sources",
    tech: "Free & public",
    tone: "bg-brand-50 ring-brand-100",
    items: ["Yahoo Finance (NSE/BSE)", "AMFI NAVs via mfapi.in", "8 Indian business RSS feeds", "Official NSE equity list"],
  },
];

const LINKS = ["HTTPS · server-sent events", "question + chat history", "tool calls", "cached HTTP requests"];

export function SystemDiagram() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <ol className="space-y-0">
        {LAYERS.map((layer, i) => {
          const dark = layer.tone.includes("text-white");
          return (
            <li key={layer.name}>
              <div className={`rounded-2xl p-4 ring-1 sm:p-5 ${layer.tone}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-[170px] items-center gap-3">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                        dark ? "bg-brand-500/20 text-brand-300" : "bg-brand-50 text-brand-600 ring-1 ring-brand-100"
                      }`}
                    >
                      <layer.icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-semibold">{layer.name}</span>
                      <span className={`block text-xs ${dark ? "text-white/55" : "text-forest-800/55"}`}>{layer.tech}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {layer.items.map((item) => (
                      <span
                        key={item}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                          dark ? "bg-white/10 text-white/85" : "bg-forest-900/[0.04] text-forest-800/80"
                        } ${item.endsWith(".py") || item.startsWith("/") ? "font-mono" : ""}`}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {i < LINKS.length && (
                <div className="flex items-center gap-2 py-2 pl-8 text-[11px] font-medium text-forest-800/50">
                  <ArrowDown className="h-4 w-4 text-brand-500" />
                  {LINKS[i]}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-dashed border-brand-300 bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Radio className="h-4 w-4 text-brand-600" /> Language models
          </p>
          <p className="mt-1 text-xs leading-5 text-forest-800/60">
            Called by the agent through one OpenAI-compatible client. Swappable with an environment variable.
          </p>
          <ModelChain compact />
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-forest-900/10">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-brand-600" /> Verifier
          </p>
          <p className="mt-1 text-xs leading-5 text-forest-800/60">
            Runs after every answer and checks each ₹ amount and % against the data the tools returned.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ─────────────────────────── Model fallback chain ─────────────────────────── */

const MODELS = [
  { name: "Qwen3.8 27B", host: "Groq", note: "Primary — fast, sticks to the data" },
  { name: "GPT-OSS 120B", host: "Groq", note: "Separate quota on the same provider" },
  { name: "Gemini Flash", host: "Google", note: "Different provider, last resort" },
];

export function ModelChain({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <ol className="mt-3 space-y-1.5">
        {MODELS.map((m, i) => (
          <li key={m.name} className="flex items-center gap-2 text-xs">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 font-mono text-[10px] font-bold text-white">
              {i + 1}
            </span>
            <span className="font-medium text-forest-900">{m.name}</span>
            <span className="text-forest-800/45">· {m.host}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
      {MODELS.map((m, i) => (
        <div key={m.name} className="contents">
          <div className="flex-1 rounded-2xl bg-white p-4 ring-1 ring-forest-900/10">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
              {i === 0 ? "First try" : `Fallback ${i}`}
            </p>
            <p className="mt-1 font-semibold">{m.name}</p>
            <p className="text-xs text-forest-800/55">on {m.host}</p>
            <p className="mt-2 text-xs leading-5 text-forest-800/65">{m.note}</p>
          </div>
          {i < MODELS.length - 1 && (
            <div className="flex shrink-0 items-center justify-center gap-1.5 px-1 text-[11px] font-medium text-amber-700 md:flex-col">
              <ArrowRight className="hidden h-4 w-4 md:block" />
              <ArrowDown className="h-4 w-4 md:hidden" />
              <span className="text-center leading-tight">quota hit
                <br className="hidden md:block" /> or down</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── Life of a question ─────────────────────────── */

const STEPS = [
  {
    icon: Search,
    title: "Understand",
    body: "The router spots “TCS” and maps it to its NSE symbol using the official list of 2,600+ listings — no fragile guessing.",
    file: "symbols.py · router.py",
  },
  {
    icon: BarChart3,
    title: "Fetch first",
    body: "Price, valuation, fundamentals and today’s headlines are fetched in parallel before the model writes a word.",
    file: "market.py · news.py",
  },
  {
    icon: BrainCircuit,
    title: "Reason",
    body: "The model reads the data and can call more tools — peers, funds, calculators — for up to four rounds.",
    file: "graph.py",
  },
  {
    icon: MessageSquareText,
    title: "Stream",
    body: "Cards render the moment data arrives; the answer streams in word by word.",
    file: "runner.py → SSE",
  },
  {
    icon: ShieldCheck,
    title: "Verify",
    body: "Every ₹ amount and percentage in the answer is matched against the fetched numbers.",
    file: "verify.py",
  },
];

const EVENTS: [string, string, string][] = [
  ["meta", "text-forest-800/60", "mode=tools · qwen3.8-27b"],
  ["tool_start", "text-sky-700", 'get_stock_snapshot("TCS")'],
  ["tool_start", "text-sky-700", 'search_news("Tata Consultancy…")'],
  ["tool_end", "text-brand-700", "stock · ₹2,522 · P/E 17.7"],
  ["tool_end", "text-brand-700", "news · 5 headlines"],
  ["token ×312", "text-forest-900", "“**Short answer:** TCS is…”"],
  ["verification", "text-brand-700", "9 of 9 figures verified"],
  ["done", "text-forest-800/60", "3.6 s"],
];

export function RequestFlow() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
      <ol className="relative space-y-5 border-l-2 border-brand-100 pl-7">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative">
            <span className="absolute top-0 -left-[43px] grid h-8 w-8 place-items-center rounded-xl bg-forest-900 text-brand-300 ring-4 ring-[#f6faf7]">
              <s.icon className="h-4 w-4" />
            </span>
            <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
              <span className="font-mono text-xs text-brand-600">0{i + 1}</span> {s.title}
              <span className="font-mono text-[11px] font-normal text-forest-800/45">{s.file}</span>
            </p>
            <p className="mt-1 text-sm leading-6 text-forest-800/70">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="self-start overflow-hidden rounded-2xl bg-forest-950 shadow-xl shadow-forest-900/10">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-brand-400" />
          <span className="font-mono text-xs text-white/60">POST /chat/stream</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-white/35">example · abridged</span>
        </div>
        <ul className="space-y-1 bg-white/[0.02] p-4 font-mono text-[12px] leading-5">
          {EVENTS.map(([type, color, value], i) => (
            <li key={i} className="grid grid-cols-[96px_1fr] gap-2">
              <span className="text-brand-300">{type}</span>
              <span className={`truncate rounded bg-white px-1.5 ${color}`}>{value}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-white/10 px-4 py-2.5 text-[11px] leading-5 text-white/50">
          One HTTP response carrying typed events — the UI draws steps, cards, text and the verification badge from them.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── Two agent modes ─────────────────────────── */

function Flow({ nodes }: { nodes: { label: string; strong?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {nodes.map((n, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              n.strong ? "bg-brand-600 text-white" : "bg-forest-900/[0.05] text-forest-800/80"
            }`}
          >
            {n.label}
          </span>
          {i < nodes.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-brand-500" />}
        </span>
      ))}
    </div>
  );
}

export function ModesDiagram() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="rounded-2xl bg-white p-6 ring-1 ring-forest-900/10">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">Tools mode · production</p>
        <h3 className="mt-1 text-lg font-semibold">The model decides what else to look up</h3>
        <p className="mt-2 text-sm leading-6 text-forest-800/65">
          Used with capable hosted models. Recognised stocks and funds are fetched up front so the model can&apos;t answer
          from memory; it then calls any extra tools it needs.
        </p>
        <div className="mt-4 rounded-xl bg-forest-900/[0.02] p-3 ring-1 ring-forest-900/5">
          <Flow
            nodes={[
              { label: "Question" },
              { label: "Prefetch" },
              { label: "LLM ⇄ tools", strong: true },
              { label: "Answer" },
              { label: "Verify" },
            ]}
          />
        </div>
      </div>
      <div className="rounded-2xl bg-white p-6 ring-1 ring-forest-900/10">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-forest-800/50">Guided mode · local models</p>
        <h3 className="mt-1 text-lg font-semibold">Python picks the tools, the model writes</h3>
        <p className="mt-2 text-sm leading-6 text-forest-800/65">
          Small offline models can&apos;t call tools reliably, so rules choose the data and the model only turns it into
          an answer. Handy for development without an API key.
        </p>
        <div className="mt-4 rounded-xl bg-forest-900/[0.02] p-3 ring-1 ring-forest-900/5">
          <Flow
            nodes={[
              { label: "Question" },
              { label: "Rule router", strong: true },
              { label: "Tools" },
              { label: "LLM writes" },
              { label: "Verify" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Verification demo ─────────────────────────── */

function Ok({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-brand-50 px-0.5 font-semibold text-brand-800 underline decoration-brand-500 decoration-2 underline-offset-4">
      {children}
    </span>
  );
}

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-50 px-0.5 font-semibold text-amber-800 underline decoration-amber-500 decoration-wavy decoration-2 underline-offset-4">
      {children}
    </span>
  );
}

export function VerificationDemo() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl bg-white p-6 ring-1 ring-forest-900/10">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-forest-800/45">Example answer</p>
        <p className="mt-3 text-[15px] leading-8 text-forest-900/85">
          TCS trades at <Ok>₹2,522</Ok>, down <Ok>16.9%</Ok> over the past year, with a market cap of{" "}
          <Ok>₹9.12 lakh crore</Ok>. Its ROE of <Ok>45.6%</Ok> is among the best in Indian IT, and the dividend yield is{" "}
          <Ok>1.95%</Ok>. Brokers expect earnings to grow <Flag>14%</Flag> next year.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-forest-900/5 pt-4 text-xs">
          <span className="flex items-center gap-1.5 text-brand-700">
            <CircleCheck className="h-4 w-4" /> matches fetched data
          </span>
          <span className="flex items-center gap-1.5 text-amber-700">
            <Hash className="h-4 w-4" /> not in fetched data — flagged to the reader
          </span>
        </div>
      </div>
      <ul className="space-y-3">
        {[
          {
            title: "Understands Indian notation",
            body: "₹9.12 lakh crore, ₹24 L, 10k and 1.5 Cr are converted to rupees before matching.",
          },
          {
            title: "Respects rounding",
            body: "“₹9.12 lakh crore” matches 9,11,84,52,00,000 — but ₹9,999 never matches ₹10,009.",
          },
          {
            title: "Shows its result",
            body: "Each answer ends with “All 6 figures verified” or a list of the figures to double-check.",
          },
        ].map((x) => (
          <li key={x.title} className="rounded-2xl bg-white p-4 ring-1 ring-forest-900/10">
            <p className="text-sm font-semibold">{x.title}</p>
            <p className="mt-1 text-sm leading-6 text-forest-800/65">{x.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────── Data sources ─────────────────────────── */

export const DATA_SOURCES = [
  { icon: BarChart3, name: "Stocks & indices", source: "Yahoo Finance (NSE, BSE)", detail: "Price, 1-year chart, P/E, P/B, ROE, debt, dividends", fresh: "cached 15 min" },
  { icon: PiggyBank, name: "Mutual funds", source: "AMFI NAVs via mfapi.in", detail: "Latest NAV; 1Y / 3Y / 5Y / since-launch CAGR computed from history", fresh: "cached 6 h" },
  { icon: Newspaper, name: "Market news", source: "Moneycontrol, ET, Mint, BS, CNBC-TV18 +3", detail: "Headlines matched to the company, sector or topic", fresh: "refreshed 10 min" },
  { icon: Landmark, name: "Company names", source: "NSE equity list", detail: "“HDFC Life”, “L&T”, “Zomato” → the right NSE symbol", fresh: "bundled" },
  { icon: Calculator, name: "Calculators", source: "Python", detail: "SIP, lumpsum and goal maths — the model never does arithmetic", fresh: "exact" },
  { icon: Route, name: "Sector baskets", source: "Curated large caps", detail: "Banking, IT, pharma, auto, FMCG, energy and 7 more", fresh: "validated at start" },
];
