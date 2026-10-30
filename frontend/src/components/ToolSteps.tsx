import { BarChart3, Calculator, Check, Landmark, Loader2, Newspaper, PiggyBank, Scale, Target, X } from "lucide-react";

export interface Step {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  status: "running" | "done" | "failed";
  error?: string;
}

const TOOLS: Record<string, { icon: typeof BarChart3; label: (i: Record<string, unknown>) => string }> = {
  get_stock_snapshot: { icon: BarChart3, label: (i) => `Market data for ${i.name_or_symbol}` },
  compare_stocks: { icon: Scale, label: (i) => `Comparing ${(i.names_or_symbols as string[] | undefined)?.join(", ") ?? "stocks"}` },
  list_sector_stocks: { icon: Landmark, label: (i) => `Scanning ${String(i.sector).toUpperCase() === "IT" ? "IT" : i.sector} large caps` },
  search_news: { icon: Newspaper, label: (i) => `Reading news: “${i.query}”` },
  get_mutual_fund: { icon: PiggyBank, label: (i) => `AMFI data for ${i.name_or_code}` },
  investment_projection: { icon: Calculator, label: (i) => `Projecting ${i.mode === "lumpsum" ? "lumpsum" : "SIP"} growth` },
  required_monthly_sip: { icon: Target, label: () => "Calculating the SIP for your goal" },
};

export function ToolSteps({ steps }: { steps: Step[] }) {
  if (!steps.length) return null;
  return (
    <ul className="space-y-1.5">
      {steps.map((s) => {
        const meta = TOOLS[s.tool] ?? { icon: BarChart3, label: () => s.tool.replace(/_/g, " ") };
        const Icon = meta.icon;
        return (
          <li key={s.id} className="flex items-center gap-2.5 text-[13px]">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${
                s.status === "failed" ? "bg-red-50 text-red-600" : s.status === "done" ? "bg-brand-50 text-brand-600" : "bg-brand-600 text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className={`min-w-0 truncate ${s.status === "running" ? "font-medium text-forest-950" : "text-forest-800/65"}`}>
              {meta.label(s.input)}
            </span>
            {s.status === "running" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-600" />}
            {s.status === "done" && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
            {s.status === "failed" && (
              <span className="flex min-w-0 items-center gap-1 text-xs text-red-600" title={s.error}>
                <X className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{s.error ?? "unavailable"}</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
