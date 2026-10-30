import { ArrowDownRight, ArrowUpRight, Award, CircleCheck, Landmark, ListChecks, PiggyBank, Target, TriangleAlert } from "lucide-react";
import type {
  CompareData,
  FundData,
  GoalData,
  ProjectionData,
  ReportData,
  ScorecardPillar,
  StockData,
  ToolData,
} from "@/lib/api";
import { formatINR, formatINRCompact, formatPct, formatPrice, formatRatio, titleCase } from "@/lib/format";
import { Sparkline } from "./Sparkline";

function Change({ value, className = "" }: { value: number | null; className?: string }) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold ${
        up ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-700"
      } ${className}`}
    >
      <Icon className="h-3 w-3" />
      {formatPct(Math.abs(value), 2)}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-forest-900/[0.03] px-3 py-2">
      <dt className="text-[11px] font-medium text-forest-800/55">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-semibold text-forest-950">{value}</dd>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up overflow-hidden rounded-2xl bg-white ring-1 ring-forest-900/5">{children}</div>;
}

function StockCard({ d }: { d: StockData }) {
  const isIndex = d.exchange === "Index";
  const range = d.high_52w && d.low_52w && d.high_52w > d.low_52w ? (d.price - d.low_52w) / (d.high_52w - d.low_52w) : null;
  return (
    <Shell>
      <div className="flex items-start justify-between gap-4 px-4 pt-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-forest-950">{d.name}</p>
          <p className="mt-0.5 text-xs text-forest-800/55">
            {isIndex ? "Index" : `${d.symbol} · ${d.exchange}`}
            {d.sector ? ` · ${d.sector}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-lg font-bold text-forest-950">{formatPrice(d.price, !isIndex)}</p>
          <Change value={d.change_pct} />
        </div>
      </div>
      <div className="px-2">
        <Sparkline points={d.chart} />
      </div>
      <div className="flex items-center justify-between px-4 pb-1 text-[11px] text-forest-800/50">
        <span>1 year</span>
        <span>
          1Y return <span className={`font-semibold ${(d.return_1y_pct ?? 0) >= 0 ? "text-brand-700" : "text-red-600"}`}>{formatPct(d.return_1y_pct, 1, true)}</span>
        </span>
      </div>
      {range !== null && (
        <div className="px-4 pt-2">
          <div className="relative h-1.5 rounded-full bg-gradient-to-r from-red-200 via-gold-300 to-brand-300">
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-forest-900 shadow"
              style={{ left: `${(Math.min(1, Math.max(0, range)) * 100).toFixed(1)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[11px] text-forest-800/55">
            <span>52W low {formatPrice(d.low_52w!, !isIndex)}</span>
            <span>52W high {formatPrice(d.high_52w!, !isIndex)}</span>
          </div>
        </div>
      )}
      {!isIndex && (
        <dl className="grid grid-cols-3 gap-2 p-4">
          <Metric label="Market cap" value={d.market_cap ? formatINRCompact(d.market_cap) : "—"} />
          <Metric label="P/E" value={formatRatio(d.pe, 1)} />
          <Metric label="P/B" value={formatRatio(d.pb, 1)} />
          <Metric label="ROE" value={formatPct(d.roe_pct)} />
          <Metric label="Debt/Equity" value={formatRatio(d.debt_to_equity)} />
          <Metric label="Div. yield" value={formatPct(d.dividend_yield_pct, 2)} />
        </dl>
      )}
      {(d.vs_dma200_pct != null || d.volatility_pct != null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-forest-900/5 px-4 py-2.5 text-[11px] text-forest-800/60">
          {d.vs_dma200_pct != null && (
            <span>
              vs 200-day avg <Signed value={d.vs_dma200_pct} />
            </span>
          )}
          {d.vs_dma50_pct != null && (
            <span>
              vs 50-day avg <Signed value={d.vs_dma50_pct} />
            </span>
          )}
          {d.from_52w_high_pct != null && (
            <span>
              from 52W high <Signed value={d.from_52w_high_pct} />
            </span>
          )}
          {d.volatility_pct != null && (
            <span>
              volatility <span className="font-mono font-semibold text-forest-900">{formatPct(d.volatility_pct, 0)}</span>
            </span>
          )}
        </div>
      )}
      {isIndex && <div className="h-1" />}
    </Shell>
  );
}

function Signed({ value }: { value: number }) {
  return (
    <span className={`font-mono font-semibold ${value >= 0 ? "text-brand-700" : "text-red-600"}`}>
      {formatPct(value, 1, true)}
    </span>
  );
}

const TONE: Record<ScorecardPillar["tone"], { chip: string; dot: string }> = {
  good: { chip: "bg-brand-50 text-brand-800 ring-brand-200", dot: "bg-brand-500" },
  neutral: { chip: "bg-gold-300/25 text-amber-900 ring-gold-300", dot: "bg-gold-400" },
  bad: { chip: "bg-red-50 text-red-800 ring-red-200", dot: "bg-red-500" },
  na: { chip: "bg-forest-900/5 text-forest-800/60 ring-forest-900/10", dot: "bg-forest-800/30" },
};

function ReportCard({ r }: { r: ReportData }) {
  const { scorecard, financials, peers } = r;
  const years = financials.annual ?? [];
  const maxRevenue = Math.max(...years.map((y) => y.revenue), 1);
  return (
    <>
      <StockCard d={r.snapshot} />
      <Shell>
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
          <p className="flex items-center gap-2 font-semibold text-forest-950">
            <ListChecks className="h-4 w-4 text-brand-600" /> FinSage scorecard
          </p>
          <p className="text-[11px] text-forest-800/50">Rule-based screen · not a recommendation</p>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {scorecard.pillars.map((p) => (
            <div key={p.name} className="rounded-xl bg-forest-900/[0.02] p-3 ring-1 ring-forest-900/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-forest-800/60">{p.name}</span>
                <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TONE[p.tone].chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${TONE[p.tone].dot}`} /> {p.label}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-[12px] leading-5 text-forest-800/75">
                {p.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-forest-900/5 px-4 py-3">
          {scorecard.red_flags.length ? (
            <ul className="space-y-1">
              {scorecard.red_flags.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[12px] text-red-800">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" /> {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-[12px] text-brand-800">
              <CircleCheck className="h-3.5 w-3.5 text-brand-600" /> No red flags on these checks
            </p>
          )}
        </div>

        {years.length > 1 && (
          <div className="border-t border-forest-900/5 px-4 py-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-forest-800/55">
              <span className="font-semibold uppercase tracking-wider">Revenue &amp; net profit</span>
              <span>
                {financials.revenue_cagr_pct != null && <>Revenue {formatPct(financials.revenue_cagr_pct, 1, true)}/yr · </>}
                {financials.profit_cagr_pct != null && <>Profit {formatPct(financials.profit_cagr_pct, 1, true)}/yr</>}
              </span>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }}>
              {years.map((y) => (
                <div key={y.fy} className="flex flex-col items-center gap-1">
                  <div className="flex h-16 w-full items-end justify-center gap-1">
                    <div className="w-3 rounded-t bg-forest-900/20" style={{ height: `${((y.revenue / maxRevenue) * 100).toFixed(1)}%` }} title={`Revenue ${formatINRCompact(y.revenue)}`} />
                    <div
                      className={`w-3 rounded-t ${y.net_income >= 0 ? "bg-brand-500" : "bg-red-400"}`}
                      style={{ height: `${((Math.abs(y.net_income) / maxRevenue) * 100).toFixed(1)}%` }}
                      title={`Net profit ${formatINRCompact(y.net_income)}`}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-forest-800/60">{y.fy}</span>
                  <span className="font-mono text-[10px] text-forest-900">{formatINRCompact(y.net_income)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-forest-800/55">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-forest-900/20" /> Revenue</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand-500" /> Net profit</span>
              {financials.pe_median_history != null && <span>Past P/E median {formatRatio(financials.pe_median_history, 1)}</span>}
              {peers?.pe_median != null && <span>Peer P/E median {formatRatio(peers.pe_median, 1)}</span>}
            </div>
          </div>
        )}
      </Shell>
    </>
  );
}

const HIGHLIGHT_LABELS: Record<string, string> = {
  lowest_pe: "Lowest P/E",
  highest_roe: "Highest ROE",
  best_1y_return: "Best 1Y return",
  lowest_debt: "Lowest debt",
};

function CompareCard({ d }: { d: CompareData }) {
  const badges = Object.entries(d.highlights).filter(([, v]) => v);
  return (
    <Shell>
      <div className="flex items-center gap-2 px-4 pt-4">
        <Landmark className="h-4 w-4 text-brand-600" />
        <p className="font-semibold text-forest-950">{d.sector ? `${titleCase(d.sector)} large caps` : "Comparison"}</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-y border-forest-900/5 bg-forest-900/[0.02] text-left text-[11px] font-medium uppercase tracking-wide text-forest-800/50">
              <th className="px-4 py-2">Stock</th>
              <th className="px-2 py-2 text-right">Price</th>
              <th className="px-2 py-2 text-right">1Y</th>
              <th className="px-2 py-2 text-right">Mkt cap</th>
              <th className="px-2 py-2 text-right">P/E</th>
              <th className="px-2 py-2 text-right">ROE</th>
              <th className="px-4 py-2 text-right">Div.</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px]">
            {d.rows.map((r) => (
              <tr key={r.symbol} className="border-b border-forest-900/5 last:border-0">
                <td className="px-4 py-2.5 font-sans">
                  <span className="font-semibold text-forest-950">{r.symbol}</span>
                  <span className="block max-w-[160px] truncate text-[11px] text-forest-800/50">{r.name}</span>
                </td>
                <td className="px-2 py-2.5 text-right">{formatPrice(r.price)}</td>
                <td className={`px-2 py-2.5 text-right ${(r.return_1y_pct ?? 0) >= 0 ? "text-brand-700" : "text-red-600"}`}>
                  {formatPct(r.return_1y_pct, 1, true)}
                </td>
                <td className="px-2 py-2.5 text-right">{r.market_cap ? formatINRCompact(r.market_cap) : "—"}</td>
                <td className={`px-2 py-2.5 text-right ${d.highlights.lowest_pe === r.symbol ? "font-bold text-brand-700" : ""}`}>{formatRatio(r.pe, 1)}</td>
                <td className={`px-2 py-2.5 text-right ${d.highlights.highest_roe === r.symbol ? "font-bold text-brand-700" : ""}`}>{formatPct(r.roe_pct)}</td>
                <td className="px-4 py-2.5 text-right">{formatPct(r.dividend_yield_pct, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-forest-900/5 px-4 py-3">
          {badges.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-800 ring-1 ring-brand-100">
              <Award className="h-3 w-3" /> {HIGHLIGHT_LABELS[k] ?? k}: <span className="font-semibold">{v}</span>
            </span>
          ))}
        </div>
      )}
    </Shell>
  );
}

function FundCard({ d }: { d: FundData }) {
  const ret = [
    ["1Y", d.returns["1y"]],
    ["3Y", d.returns["3y"]],
    ["5Y", d.returns["5y"]],
    ["Since launch", d.returns.inception],
  ] as const;
  return (
    <Shell>
      <div className="flex items-start justify-between gap-4 px-4 pt-4">
        <div className="min-w-0">
          <p className="font-semibold leading-snug text-forest-950">{d.name}</p>
          <p className="mt-0.5 text-xs text-forest-800/55">
            {[d.fund_house, d.category?.replace(/^.*?Scheme - /, "")].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-lg font-bold text-forest-950">{formatPrice(d.nav)}</p>
          <p className="text-[11px] text-forest-800/50">NAV · {new Date(d.nav_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
        </div>
      </div>
      <div className="px-2">
        <Sparkline points={d.chart} />
      </div>
      <dl className="grid grid-cols-4 gap-2 p-4 pt-2">
        {ret.map(([label, v]) => (
          <div key={label} className="rounded-lg bg-forest-900/[0.03] px-3 py-2">
            <dt className="text-[11px] font-medium text-forest-800/55">{label}</dt>
            <dd className={`mt-0.5 font-mono text-sm font-semibold ${v === null ? "text-forest-800/40" : v >= 0 ? "text-brand-700" : "text-red-600"}`}>
              {formatPct(v, 1)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="px-4 pb-3 text-[11px] text-forest-800/45">Annualised (CAGR) from AMFI NAVs. Past performance doesn&apos;t guarantee future returns.</p>
    </Shell>
  );
}

function ProjectionCard({ d }: { d: ProjectionData }) {
  const max = d.yearly[d.yearly.length - 1]?.value || 1;
  return (
    <Shell>
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-forest-950">
            <PiggyBank className="h-4 w-4 text-brand-600" />
            {d.mode === "sip" ? `${formatINR(d.amount)}/month SIP` : `${formatINR(d.amount)} lumpsum`}
          </p>
          <p className="mt-0.5 text-xs text-forest-800/55">
            {d.years} years at an assumed {d.annual_return_pct}% p.a.
          </p>
          <p className="mt-3 font-mono text-2xl font-bold text-forest-950">{formatINR(d.value)}</p>
          <p className="text-xs text-brand-700">
            {d.multiple}× · +{formatINRCompact(d.gains)} gains on {formatINRCompact(d.invested)} invested
          </p>
        </div>
        <div className="flex h-24 items-end gap-[2px]" role="img" aria-label="Value by year">
          {d.yearly.map((r) => (
            <div key={r.year} className="flex h-full flex-1 flex-col justify-end" title={`Year ${r.year}: ${formatINRCompact(r.value)}`}>
              <div className="rounded-t-[2px] bg-brand-400" style={{ height: `${(((r.value - r.invested) / max) * 100).toFixed(2)}%` }} />
              <div className="bg-forest-900/15" style={{ height: `${((r.invested / max) * 100).toFixed(2)}%` }} />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function GoalCard({ d }: { d: GoalData }) {
  return (
    <Shell>
      <div className="flex items-center gap-4 p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Target className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-forest-800/55">
            To reach {formatINRCompact(d.target)} in {d.years} years at {d.annual_return_pct}% p.a.
          </p>
          <p className="font-mono text-2xl font-bold text-forest-950">
            {formatINR(d.monthly_sip)}
            <span className="font-sans text-sm font-medium text-forest-800/55"> / month</span>
          </p>
        </div>
        <div className="hidden text-right text-xs text-forest-800/55 sm:block">
          <p>Invested {formatINRCompact(d.invested)}</p>
          <p className="text-brand-700">Gains {formatINRCompact(d.gains)}</p>
        </div>
      </div>
    </Shell>
  );
}

/** Renders the structured result of a tool, or nothing for tools without a card (news → sources). */
export function DataCard({ data }: { data: ToolData }) {
  switch (data.kind) {
    case "report":
      return <ReportCard r={data} />;
    case "stock":
      return <StockCard d={data} />;
    case "compare":
      return <CompareCard d={data} />;
    case "fund":
      return <FundCard d={data} />;
    case "projection":
      return <ProjectionCard d={data} />;
    case "goal":
      return <GoalCard d={data} />;
    default:
      return null;
  }
}
