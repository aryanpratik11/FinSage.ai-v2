"use client";

import { useMemo, useState } from "react";
import { formatINR, formatINRCompact } from "@/lib/format";

type Mode = "sip" | "lumpsum";

function project(mode: Mode, amount: number, annualRate: number, years: number) {
  const rows: { year: number; invested: number; value: number }[] = [];
  const i = annualRate / 100 / 12;
  for (let y = 1; y <= years; y++) {
    const n = y * 12;
    if (mode === "sip") {
      const value = i === 0 ? amount * n : amount * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
      rows.push({ year: y, invested: amount * n, value });
    } else {
      rows.push({ year: y, invested: amount, value: amount * Math.pow(1 + annualRate / 100, y) });
    }
  }
  return rows;
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-forest-800/80">{label}</span>
        <span className="rounded-lg bg-brand-50 px-3 py-1 font-mono text-sm font-semibold text-brand-800 ring-1 ring-brand-100">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--color-brand-500) ${(((value - min) / (max - min)) * 100).toFixed(2)}%, var(--color-brand-100) 0)`,
        }}
      />
    </label>
  );
}

export function SipCalculator() {
  const [mode, setMode] = useState<Mode>("sip");
  const [amount, setAmount] = useState(10000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(15);

  const rows = useMemo(() => project(mode, amount, rate, years), [mode, amount, rate, years]);
  const last = rows[rows.length - 1];
  const gains = last.value - last.invested;
  const maxValue = last.value;

  const switchMode = (m: Mode) => {
    setMode(m);
    setAmount(m === "sip" ? 10000 : 500000);
  };

  return (
    <div className="grid gap-8 rounded-3xl bg-white p-6 shadow-xl shadow-forest-900/5 ring-1 ring-forest-900/5 sm:p-8 lg:grid-cols-[1fr_1.15fr]">
      <div className="space-y-7">
        <div className="inline-flex rounded-full bg-brand-50 p-1 ring-1 ring-brand-100">
          {(["sip", "lumpsum"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${
                mode === m ? "bg-brand-600 text-white shadow" : "text-brand-800 hover:text-brand-900"
              }`}
            >
              {m === "sip" ? "Monthly SIP" : "Lumpsum"}
            </button>
          ))}
        </div>

        {mode === "sip" ? (
          <Slider label="Monthly investment" value={amount} display={formatINR(amount)} min={500} max={200000} step={500} onChange={setAmount} />
        ) : (
          <Slider label="Total investment" value={amount} display={formatINR(amount)} min={10000} max={10000000} step={10000} onChange={setAmount} />
        )}
        <Slider label="Expected return (p.a.)" value={rate} display={`${rate}%`} min={1} max={30} step={0.5} onChange={setRate} />
        <Slider label="Time period" value={years} display={`${years} yr`} min={1} max={40} step={1} onChange={setYears} />

        <dl className="grid grid-cols-3 gap-3 border-t border-forest-900/5 pt-6">
          <div>
            <dt className="text-xs font-medium text-forest-800/60">Invested</dt>
            <dd className="mt-1 font-mono text-base font-semibold sm:text-lg">{formatINRCompact(last.invested)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-forest-800/60">Est. returns</dt>
            <dd className="mt-1 font-mono text-base font-semibold text-brand-600 sm:text-lg">+{formatINRCompact(gains)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-forest-800/60">Total value</dt>
            <dd className="mt-1 font-mono text-base font-semibold sm:text-lg">{formatINRCompact(last.value)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col rounded-2xl bg-forest-900 p-6 text-white">
        <p className="text-sm text-white/60">Projected value after {years} years</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-tight sm:text-4xl">{formatINR(last.value)}</p>
        <p className="mt-1 text-sm text-brand-300">
          {(last.value / last.invested).toFixed(2)}× your money · {formatINR(gains)} in gains
        </p>

        <div className="mt-6 flex flex-1 items-end gap-[3px]" style={{ minHeight: 180 }} role="img" aria-label="Growth by year">
          {rows.map((r) => (
            <div key={r.year} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className="w-full rounded-t-[3px] bg-brand-400 transition-all group-hover:bg-brand-300"
                style={{ height: `${(((r.value - r.invested) / maxValue) * 100).toFixed(2)}%` }}
              />
              <div
                className="w-full bg-white/20 transition-all group-hover:bg-white/30"
                style={{ height: `${((r.invested / maxValue) * 100).toFixed(2)}%` }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs text-forest-950 shadow-lg group-hover:block">
                <span className="font-semibold">Year {r.year}</span> · {formatINRCompact(r.value)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-5 text-xs text-white/60">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-white/20" /> Invested</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-400" /> Returns</span>
        </div>
      </div>
    </div>
  );
}
