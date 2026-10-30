import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Newspaper,
  Scale,
  ShieldCheck,
  Sparkles,
  MessageSquareText,
  Workflow,
  FileCheck2,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Logo, SageMark } from "@/components/Logo";
import { SipCalculator } from "@/components/SipCalculator";

const TOPICS = [
  "NIFTY 50", "SENSEX", "Bank Nifty", "Large-cap stocks", "Mutual funds", "SIPs", "IT sector",
  "PSU banks", "FMCG", "Pharma", "Auto", "Energy", "Dividend stocks", "Tax-saving ELSS",
];

const FEATURES = [
  {
    icon: Newspaper,
    title: "Live market news",
    body: "Scans Moneycontrol, Economic Times, CNBC and more for the headlines that actually move your stock.",
  },
  {
    icon: BarChart3,
    title: "Fundamentals in ₹",
    body: "Market cap, P/E, ROE, debt-to-equity and 52-week range pulled from NSE/BSE data sources.",
  },
  {
    icon: Scale,
    title: "Peer comparison",
    body: "Ask for the best banking or IT stocks and get a side-by-side view of valuations and returns.",
  },
  {
    icon: ShieldCheck,
    title: "Risk-first outlook",
    body: "Every answer flags market, regulatory and valuation risks — scenarios, never guarantees.",
  },
];

const STEPS = [
  {
    icon: MessageSquareText,
    title: "Ask in plain English",
    body: "“Should I buy TCS?” or “Where do I invest ₹10,000 a month?” — no jargon required.",
  },
  {
    icon: Workflow,
    title: "Agents do the research",
    body: "A planner routes your question to news, data, comparison and risk agents that work in parallel.",
  },
  {
    icon: FileCheck2,
    title: "Get a clear answer",
    body: "One synthesised response with the reasoning, risks, and what to watch next.",
  },
];

const ALLOCATION = [
  { label: "Nifty 50 index fund", pct: 50, amount: "₹5,000" },
  { label: "Flexi-cap fund", pct: 30, amount: "₹3,000" },
  { label: "Short-duration debt", pct: 20, amount: "₹2,000" },
];

function HeroPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-brand-500/20 blur-3xl" />
      <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-white/40">Example conversation</span>
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </span>
        </div>

        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-forest-950">
          I can invest ₹10,000 every month. Where should I start?
        </div>

        <div className="mt-4 rounded-2xl rounded-bl-md bg-white p-4 text-forest-950 shadow-lg">
          <div className="mb-3 flex items-center gap-2">
            <SageMark className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-semibold">FinSage</span>
            <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              Goal planning
            </span>
          </div>
          <p className="text-sm leading-6 text-forest-900/80">
            For a long-term goal, a diversified SIP mix balances growth and stability:
          </p>
          <div className="mt-3 space-y-2.5">
            {ALLOCATION.map((a) => (
              <div key={a.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-forest-900/80">{a.label}</span>
                  <span className="font-mono font-semibold">{a.amount}</span>
                </div>
                <div className="h-1.5 rounded-full bg-brand-50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                    style={{ width: `${a.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {["News", "Fundamentals", "Risk check", "Outlook"].map((t) => (
              <span key={t} className="rounded-md bg-forest-900/5 px-2 py-0.5 text-[11px] font-medium text-forest-800/70">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-forest-950 pt-16">
          <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
          <div className="absolute top-0 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-brand-600/25 blur-[120px]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-28">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs font-semibold text-brand-300">
                <Sparkles className="h-3.5 w-3.5" /> Built for NSE &amp; BSE investors
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Make every <span className="text-gold-300">₹</span> work
                <br />
                <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">smarter.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-white/65">
                FinSage is your AI research analyst. Ask about any Indian stock, sector or savings goal and get a
                clear answer backed by live news, fundamentals and risk analysis.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/chat"
                  className="group flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3.5 text-sm font-semibold text-forest-950 shadow-lg shadow-brand-500/25 transition hover:bg-brand-400"
                >
                  Ask FinSage
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#sip-calculator"
                  className="rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/5"
                >
                  Try the SIP calculator
                </a>
              </div>
            </div>
            <HeroPreview />
          </div>

          {/* Topic strip */}
          <div className="relative overflow-hidden border-t border-white/5 bg-forest-900/60 py-4">
            <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
              {[...TOPICS, ...TOPICS].map((t, i) => (
                <span key={i} className="flex items-center gap-10 text-sm font-medium text-white/45">
                  {t}
                  <span className="text-brand-500/60">₹</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">What FinSage does</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                A team of AI analysts, working on your question.
              </h2>
              <p className="mt-4 text-lg leading-8 text-forest-800/70">
                Instead of one model guessing, specialised agents each research one part of the picture.
              </p>
            </div>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl bg-white p-6 ring-1 ring-forest-900/5 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-900/5 hover:ring-brand-200"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 transition group-hover:bg-brand-600 group-hover:text-white">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-forest-800/65">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16 bg-white py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">How it works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">From question to conviction in seconds.</h2>
            </div>
            <div className="relative mt-16 grid gap-10 md:grid-cols-3">
              <div className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200 md:block" />
              {STEPS.map((s, i) => (
                <div key={s.title} className="relative text-center">
                  <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-forest-900 text-brand-300 shadow-lg shadow-forest-900/20">
                    <s.icon className="h-6 w-6" />
                    <span className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-xs font-bold text-forest-950">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-6 font-semibold">{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-forest-800/65">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SIP calculator */}
        <section id="sip-calculator" className="scroll-mt-16 py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div className="max-w-xl">
                <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Plan your wealth</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">See what your SIP can grow into.</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-forest-800/65">
                Returns are illustrative and assume a constant annual rate. Actual mutual fund returns vary with markets.
              </p>
            </div>
            <SipCalculator />
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-forest-900 px-6 py-16 text-center sm:px-12">
            <div className="grid-bg absolute inset-0 opacity-60" />
            <div className="absolute -bottom-32 left-1/2 h-72 w-[700px] -translate-x-1/2 rounded-full bg-brand-500/30 blur-[100px]" />
            <div className="relative">
              <Brain className="mx-auto h-10 w-10 text-brand-300" />
              <h2 className="mx-auto mt-5 max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Your next investing question deserves a better answer.
              </h2>
              <Link
                href="/chat"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 text-sm font-semibold text-forest-950 transition hover:bg-brand-400"
              >
                Start a conversation <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-forest-900/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Logo className="h-12" />
            <p className="max-w-md text-xs leading-5 text-forest-800/55">
              FinSage.ai provides AI-generated research for educational purposes only. It is not a SEBI-registered
              investment adviser and nothing here is a recommendation to buy or sell securities. Investments are
              subject to market risks; please read all scheme-related documents carefully.
            </p>
          </div>
          <p className="text-xs text-forest-800/50">© {new Date().getFullYear()} FinSage.ai · Made in India</p>
        </div>
      </footer>
    </>
  );
}
