import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  CircleCheck,
  CircleX,
  Clock,
  Gauge,
  Layers,
  Lightbulb,
  ListChecks,
  Rocket,
  ShieldCheck,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";
import {
  DATA_SOURCES,
  ModelChain,
  ModesDiagram,
  RequestFlow,
  SystemDiagram,
  VerificationDemo,
} from "@/components/ArchitectureDiagrams";

export const metadata: Metadata = {
  title: "How FinSage works · FinSage.ai",
  description: "The idea behind FinSage and how it turns live Indian market data into answers you can check.",
};

const COMPARISON = [
  ["Where numbers come from", "Training data or whatever web page turns up", "Live NSE/BSE prices, AMFI NAVs and Indian news, fetched per question"],
  ["Maths", "Done by the language model", "Done in Python — SIP, CAGR and goal calculators"],
  ["Indian context", "Generic", "₹, lakh/crore, NSE symbols, SEBI fund categories"],
  ["Checking itself", "No", "Every ₹ and % in the answer is matched against the data"],
  ["Showing its work", "Sometimes", "Tool steps, data cards and source links on every answer"],
];

const STACK = [
  { layer: "Frontend", items: ["Next.js 16", "React 19", "Tailwind CSS 4", "Server-sent events"] },
  { layer: "Backend", items: ["Python 3.12", "FastAPI", "LangGraph", "LangChain (OpenAI client)"] },
  { layer: "Models", items: ["Groq · Qwen3.8 27B", "Groq · GPT-OSS 120B", "Google · Gemini Flash"] },
  { layer: "Data", items: ["yfinance", "mfapi.in (AMFI)", "feedparser (RSS)", "NSE equity list"] },
  { layer: "Quality & ops", items: ["pytest (50 tests)", "41-question eval set", "ruff", "Docker", "Render"] },
];

const EVAL = [
  { value: "89%", label: "of 405 figures verified against live data" },
  { value: "95%", label: "of answers covered the points a good answer needs" },
  { value: "100%", label: "of answers made no promise of returns" },
  { value: "2.6 s", label: "median time to a full answer" },
];

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-lg leading-8 text-forest-800/70">{children}</p>}
    </div>
  );
}

export default function ArchitecturePage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-forest-950 pt-16">
          <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
          <div className="absolute top-0 left-1/2 h-[420px] w-[800px] -translate-x-1/2 rounded-full bg-brand-600/25 blur-[120px]" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs font-semibold text-brand-300">
              <Layers className="h-3.5 w-3.5" /> Under the hood
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
              An AI analyst that <span className="text-brand-400">shows its work.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">
              General chatbots answer money questions from memory. FinSage looks the numbers up first — live Indian
              market data, official mutual fund NAVs, today&apos;s business news — then explains them, and checks its own
              answer before you read it.
            </p>
            <dl className="mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["7", "data tools"],
                ["2,600+", "NSE listings understood"],
                ["3", "AI models in the fallback chain"],
                ["₹0", "to run on free tiers"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <dt className="font-mono text-2xl font-bold text-white">{v}</dt>
                  <dd className="mt-1 text-xs text-white/55">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* The idea */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="The idea" title="Specialised beats general — when it’s grounded.">
              FinSage doesn&apos;t try to out-think a frontier chatbot. It wins by bringing fresher, India-specific data to
              the question, doing the maths in code, and making every number checkable.
            </SectionHeading>

            <div className="mt-12 overflow-hidden rounded-2xl bg-white ring-1 ring-forest-900/10">
              <div className="grid grid-cols-[1fr_1fr] border-b border-forest-900/5 bg-forest-900/[0.02] text-xs font-semibold uppercase tracking-wider sm:grid-cols-[1fr_1.2fr_1.4fr]">
                <span className="hidden px-5 py-3 text-forest-800/50 sm:block">&nbsp;</span>
                <span className="px-5 py-3 text-forest-800/50">General chatbot</span>
                <span className="px-5 py-3 text-brand-700">FinSage</span>
              </div>
              {COMPARISON.map(([aspect, general, finsage]) => (
                <div
                  key={aspect}
                  className="grid grid-cols-[1fr_1fr] border-b border-forest-900/5 last:border-0 sm:grid-cols-[1fr_1.2fr_1.4fr]"
                >
                  <span className="col-span-2 px-5 pt-4 text-sm font-semibold sm:col-span-1 sm:py-4">{aspect}</span>
                  <span className="flex items-start gap-2 px-5 py-3 text-sm text-forest-800/60 sm:py-4">
                    <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-forest-800/30" /> {general}
                  </span>
                  <span className="flex items-start gap-2 px-5 py-3 text-sm text-forest-900 sm:py-4">
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {finsage}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="bg-white py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="Architecture" title="Five layers, each with one job.">
              The web app talks to a small API. The API hands each question to an agent, the agent uses plain Python
              tools, and the tools talk to public data sources. Language models are a pluggable part, not the
              foundation.
            </SectionHeading>
            <div className="mt-12">
              <SystemDiagram />
            </div>
          </div>
        </section>

        {/* Request lifecycle */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="Life of a question" title="“Should I invest in TCS right now?”">
              Here&apos;s what happens in the three or four seconds between pressing Enter and reading the answer.
            </SectionHeading>
            <div className="mt-12">
              <RequestFlow />
            </div>
          </div>
        </section>

        {/* Data */}
        <section className="bg-white py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="Data" title="Where every number comes from.">
              Free, public sources, cached so repeat questions are instant and the sources aren&apos;t overloaded.
            </SectionHeading>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DATA_SOURCES.map((d) => (
                <div key={d.name} className="rounded-2xl bg-[#f6faf7] p-5 ring-1 ring-forest-900/5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-brand-100">
                      <d.icon className="h-5 w-5" />
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-forest-800/60 ring-1 ring-forest-900/5">
                      <Clock className="h-3 w-3" /> {d.fresh}
                    </span>
                  </div>
                  <p className="mt-4 font-semibold">{d.name}</p>
                  <p className="text-xs font-medium text-brand-700">{d.source}</p>
                  <p className="mt-2 text-sm leading-6 text-forest-800/65">{d.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Agent modes + resilience */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl space-y-20 px-4 sm:px-6">
            <div>
              <SectionHeading eyebrow="The agent" title="Two ways to think, one graph library.">
                Both modes are LangGraph graphs and stream the same events, so the web app doesn&apos;t care which one
                answered.
              </SectionHeading>
              <div className="mt-10">
                <ModesDiagram />
              </div>
            </div>
            <div>
              <SectionHeading eyebrow="Reliability" title="Built to survive free-tier limits.">
                Free AI tiers allow only a couple of answers per minute per model. When one is busy or down, the next
                model takes over instantly — no waiting, no error for the user.
              </SectionHeading>
              <div className="mt-10">
                <ModelChain />
              </div>
            </div>
          </div>
        </section>

        {/* Verification */}
        <section className="bg-white py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="Trust" title="Every number, checked.">
              After each answer, a verifier reads every rupee amount and percentage and looks for it in the data the
              tools returned. Anything it can&apos;t find is flagged — made-up numbers can&apos;t slip through quietly.
            </SectionHeading>
            <div className="mt-12">
              <VerificationDemo />
            </div>
          </div>
        </section>

        {/* Quality */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="Measured, not claimed" title="Tested on 41 real Indian-market questions.">
              Stocks, comparisons, sectors, mutual funds, SIP maths, tax questions and market news — scored
              automatically on every change.
            </SectionHeading>
            <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {EVAL.map((e) => (
                <div key={e.label} className="rounded-2xl bg-forest-900 p-6 text-white">
                  <dt className="font-mono text-4xl font-bold text-brand-300">{e.value}</dt>
                  <dd className="mt-2 text-sm leading-6 text-white/65">{e.label}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 flex items-center gap-2 text-xs text-forest-800/55">
              <Gauge className="h-3.5 w-3.5" /> Baseline run on 30 Oct 2026, free-tier models. The weakest area today is
              tax rules, which the model still answers from memory.
            </p>
          </div>
        </section>

        {/* Stack + limits */}
        <section className="bg-white py-24">
          <div className="mx-auto grid max-w-6xl gap-16 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <SectionHeading eyebrow="Tech stack" title="Small, boring, replaceable parts." />
              <dl className="mt-10 space-y-4">
                {STACK.map((s) => (
                  <div key={s.layer} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <dt className="flex w-32 shrink-0 items-center gap-2 pt-1 text-sm font-semibold">
                      <Blocks className="h-4 w-4 text-brand-600" /> {s.layer}
                    </dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {s.items.map((i) => (
                        <span key={i} className="rounded-lg bg-forest-900/[0.04] px-2.5 py-1 text-xs font-medium text-forest-800/80">
                          {i}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl bg-amber-50/70 p-6 ring-1 ring-amber-100">
                <p className="flex items-center gap-2 font-semibold text-amber-900">
                  <TriangleAlert className="h-4 w-4" /> Honest limits
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900/80">
                  <li>• Yahoo Finance data can lag or be rate-limited; when a lookup fails, FinSage says so.</li>
                  <li>• Free AI tiers cap how many answers per minute the site can give.</li>
                  <li>• Tax rules and general concepts still come from the model&apos;s own knowledge.</li>
                  <li>• FinSage is an educational tool, not a SEBI-registered investment adviser.</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-brand-50/70 p-6 ring-1 ring-brand-100">
                <p className="flex items-center gap-2 font-semibold text-brand-900">
                  <Rocket className="h-4 w-4" /> What&apos;s next
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-brand-900/80">
                  <li className="flex gap-2"><ListChecks className="mt-1 h-4 w-4 shrink-0" /> Quarterly results trend and valuation vs. history and peers</li>
                  <li className="flex gap-2"><ShieldCheck className="mt-1 h-4 w-4 shrink-0" /> A consistent stock scorecard: valuation, growth, quality, momentum, red flags</li>
                  <li className="flex gap-2"><Zap className="mt-1 h-4 w-4 shrink-0" /> Company-specific news and official NSE filings</li>
                  <li className="flex gap-2"><Lightbulb className="mt-1 h-4 w-4 shrink-0" /> A dated knowledge base for Indian tax rules</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-24 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-forest-900 px-6 py-14 text-center sm:px-12">
            <div className="grid-bg absolute inset-0 opacity-60" />
            <div className="relative">
              <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                See it work on your own question.
              </h2>
              <Link
                href="/chat"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 text-sm font-semibold text-forest-950 transition hover:bg-brand-400"
              >
                Ask FinSage <ArrowRight className="h-4 w-4" />
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
              investment adviser. Investments are subject to market risks.
            </p>
          </div>
          <p className="text-xs text-forest-800/50">© {new Date().getFullYear()} FinSage.ai · Made in India</p>
        </div>
      </footer>
    </>
  );
}
