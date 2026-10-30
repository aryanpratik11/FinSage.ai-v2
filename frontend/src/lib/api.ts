export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export interface Source {
  title: string;
  url: string;
  source: string;
  published?: string;
}

export interface StockData {
  kind: "stock";
  symbol: string;
  ticker: string;
  exchange: "NSE" | "BSE" | "Index";
  name: string;
  sector: string | null;
  industry: string | null;
  price: number;
  change: number | null;
  change_pct: number | null;
  high_52w: number | null;
  low_52w: number | null;
  return_1y_pct: number | null;
  market_cap: number | null;
  pe: number | null;
  pb: number | null;
  roe_pct: number | null;
  debt_to_equity: number | null;
  dividend_yield_pct: number | null;
  as_of: string;
  chart: [string, number][];
  sources: Source[];
}

export interface CompareRow {
  symbol: string;
  name: string;
  price: number;
  change_pct: number | null;
  return_1y_pct: number | null;
  market_cap: number | null;
  pe: number | null;
  roe_pct: number | null;
  debt_to_equity: number | null;
  dividend_yield_pct: number | null;
}

export interface CompareData {
  kind: "compare";
  sector?: string;
  rows: CompareRow[];
  highlights: Record<string, string | null>;
  sources: Source[];
}

export interface FundData {
  kind: "fund";
  code: number;
  name: string;
  fund_house: string | null;
  category: string | null;
  nav: number;
  nav_date: string;
  returns: { "1y": number | null; "3y": number | null; "5y": number | null; inception: number | null };
  inception_date: string;
  chart: [string, number][];
  sources: Source[];
}

export interface ProjectionData {
  kind: "projection";
  mode: "sip" | "lumpsum";
  amount: number;
  annual_return_pct: number;
  years: number;
  invested: number;
  value: number;
  gains: number;
  multiple: number;
  yearly: { year: number; invested: number; value: number }[];
}

export interface GoalData {
  kind: "goal";
  target: number;
  years: number;
  annual_return_pct: number;
  monthly_sip: number;
  invested: number;
  gains: number;
}

export interface NewsData {
  kind: "news";
  query: string;
  items: Source[];
  sources: Source[];
}

export type ToolData =
  | StockData
  | CompareData
  | FundData
  | ProjectionData
  | GoalData
  | NewsData
  | { kind: "error"; message: string };

export type StreamEvent =
  | { type: "meta"; mode: "tools" | "guided"; model: string }
  | { type: "tool_start"; id: string; tool: string; input: Record<string, unknown> }
  | { type: "tool_end"; id: string; tool: string; ok: boolean; data: ToolData }
  | { type: "token"; text: string }
  | { type: "text_reset" }
  | { type: "done"; elapsed_ms: number }
  | ({ type: "verification" } & Verification)
  | { type: "error"; message: string };

/** How many ₹ / % figures in the answer matched data FinSage fetched. */
export interface Verification {
  checked: number;
  verified: number;
  unverified: string[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** POST a question and call onEvent for each server-sent event until the stream ends. */
export async function streamChat(
  query: string,
  history: ChatTurn[],
  onEvent: (ev: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, history }),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail)) detail = "Please enter a question (up to 1,000 characters).";
    } catch {}
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of frame.split("\n")) {
        if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)) as StreamEvent);
      }
    }
  }
}

export interface Health {
  status: "ok" | "no_model";
  mode: "tools" | "guided" | null;
  models: string[];
}

export async function checkHealth(): Promise<Health | null> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as Health) : null;
  } catch {
    return null;
  }
}
