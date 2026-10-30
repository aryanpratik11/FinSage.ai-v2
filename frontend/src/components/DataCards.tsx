import { ArrowDownRight, ArrowUpRight, Award, Landmark, PiggyBank, Target } from "lucide-react";
import type { CompareData, FundData, GoalData, ProjectionData, StockData, ToolData } from "@/lib/api";
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
      {isIndex && <div className="h-3" />}
    </Shell>
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
