"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, Check, ChevronDown, Clock, Copy, ExternalLink, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Source, ToolData, Verification } from "@/lib/api";
import { normaliseRupees, timeAgo } from "@/lib/format";
import { DataCard } from "./DataCards";
import { ToolSteps, type Step } from "./ToolSteps";

export interface AssistantMsg {
  id: string;
  role: "assistant";
  query: string;
  status: "streaming" | "done" | "error";
  text: string;
  steps: Step[];
  data: ToolData[];
  error?: string;
  elapsedMs?: number;
  model?: string;
  verification?: Verification;
}

function collectSources(data: ToolData[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const d of data) {
    const list = "sources" in d ? d.sources : [];
    for (const s of list) {
      if (s.url && !seen.has(s.url)) {
        seen.add(s.url);
        out.push(s);
      }
    }
  }
  return out.slice(0, 8);
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "groq:qwen/qwen3.8-27b" → "groq · qwen/qwen3.8-27b"; "local:local" → "local model". */
function modelLabel(model: string) {
  const [provider, name] = model.split(":");
  return name && name !== provider ? `${provider} · ${name}` : `${provider} model`;
}

export function AssistantMessage({ msg, onRetry, retryDisabled }: { msg: AssistantMsg; onRetry: () => void; retryDisabled: boolean }) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showUnverified, setShowUnverified] = useState(false);
  const v = msg.verification;
  const streaming = msg.status === "streaming";
  const text = normaliseRupees(msg.text);
  const sources = collectSources(msg.data);
  const cards = msg.data.filter((d) => d.kind !== "news" && d.kind !== "error");
  const waitingForText = streaming && !text;
  const toolsRunning = msg.steps.some((s) => s.status === "running");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="min-w-0 space-y-3">
      {msg.steps.length > 0 &&
        (streaming || stepsOpen ? (
          <div className="animate-fade-up rounded-2xl rounded-tl-md bg-white px-4 py-3 ring-1 ring-forest-900/5">
            <ToolSteps steps={msg.steps} />
            {!streaming && (
              <button onClick={() => setStepsOpen(false)} className="mt-2 text-xs font-medium text-forest-800/50 hover:text-forest-900">
                Hide research steps
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setStepsOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-forest-800/65 ring-1 ring-forest-900/5 transition hover:text-forest-950"
          >
            <Check className="h-3.5 w-3.5 text-brand-600" />
            Researched with {msg.steps.length} {msg.steps.length === 1 ? "tool" : "tools"}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ))}

      {cards.map((d, i) => (
        <DataCard key={i} data={d} />
      ))}

      {msg.status === "error" ? (
        <div className="animate-fade-up rounded-2xl rounded-tl-md bg-red-50 px-5 py-4 ring-1 ring-red-100">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4" /> Couldn&apos;t complete this research
          </p>
          <p className="mt-1.5 text-sm text-red-700/80">{msg.error}</p>
          <button
            onClick={onRetry}
            disabled={retryDisabled}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-800 ring-1 ring-red-200 transition hover:bg-red-100 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      ) : (
        (text || waitingForText) && (
          <div className="animate-fade-up overflow-hidden rounded-2xl rounded-tl-md bg-white shadow-sm ring-1 ring-forest-900/5">
            <div className="prose-fin px-5 py-4 text-[15px] text-forest-900/85">
              {waitingForText ? (
                <p className="flex items-center gap-2 text-sm text-forest-800/50">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${d * 120}ms` }} />
                    ))}
                  </span>
                  {toolsRunning || msg.steps.length === 0 ? "Thinking…" : "Writing the answer…"}
                </p>
              ) : (
                <>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                  {streaming && <span className="ml-0.5 inline-block h-4 w-0.75 animate-pulse rounded-sm bg-brand-500 align-middle" />}
                </>
              )}
            </div>

            {sources.length > 0 && !streaming && (
              <div className="border-t border-forest-900/5 px-5 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-forest-800/45">Sources</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {sources.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-2 rounded-lg p-1.5 text-xs transition hover:bg-brand-50/60"
                      >
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                        <span className="min-w-0">
                          <span className="line-clamp-2 font-medium text-forest-900 group-hover:text-brand-800">{s.title}</span>
                          <span className="text-forest-800/45">
                            {s.source || host(s.url)}
                            {s.published ? ` · ${timeAgo(s.published)}` : ""}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!streaming && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-forest-900/5 px-5 py-2.5 text-xs text-forest-800/55">
                {v && v.checked > 0 &&
                  (v.unverified.length === 0 ? (
                    <span className="flex items-center gap-1.5 font-medium text-brand-700" title="Every ₹ amount and % in this answer matches live data FinSage fetched">
                      <ShieldCheck className="h-3.5 w-3.5" /> All {v.checked} figures verified
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowUnverified((s) => !s)}
                      className="flex items-center gap-1.5 rounded-md font-medium text-amber-700 transition hover:text-amber-800"
                      aria-expanded={showUnverified}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" /> {v.unverified.length} of {v.checked} figures not from live data
                      <ChevronDown className={`h-3 w-3 transition ${showUnverified ? "rotate-180" : ""}`} />
                    </button>
                  ))}
                {msg.elapsedMs !== undefined && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {(msg.elapsedMs / 1000).toFixed(1)}s
                  </span>
                )}
                {msg.model && <span className="font-mono text-[11px]">{modelLabel(msg.model)}</span>}
                <button
                  onClick={copy}
                  className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition hover:bg-forest-900/5 hover:text-forest-900"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-brand-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
            {!streaming && showUnverified && v && v.unverified.length > 0 && (
              <div className="border-t border-amber-100 bg-amber-50/70 px-5 py-3 text-xs text-amber-900">
                <p>
                  These figures didn&apos;t come from the data FinSage fetched for this answer. They may be the model&apos;s
                  general knowledge — double-check them before relying on them:
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.unverified.map((f) => (
                    <span key={f} className="rounded-md bg-white px-2 py-0.5 font-mono ring-1 ring-amber-200">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
