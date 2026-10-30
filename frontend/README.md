# FinSage.ai — Frontend

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4.

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL, default http://localhost:8000
npm run dev                  # http://localhost:3000
npm run lint                 # typecheck
npm run build
```

Run the backend from the repo root first (see the main README).

## Pages

- `/` — landing page and an interactive SIP / lumpsum calculator (₹, lakh/crore formatting)
- `/chat` — research chat. Streams from `POST /chat/stream` (server-sent events) and renders:
  - live tool steps (`tool_start` / `tool_end`)
  - data cards for stocks, comparisons, mutual funds, SIP projections and goals
  - the answer as it streams, with sources and a figure-verification badge

## Layout

- `src/lib/api.ts` — event types and the SSE client (`streamChat`, `checkHealth`)
- `src/lib/format.ts` — `formatINR`, `formatINRCompact` (₹12.3 L / ₹4.5 Cr / ₹8.97 L Cr), `formatPct`, `normaliseRupees`
- `src/components/AssistantMessage.tsx` — one answer: steps, cards, markdown, sources, verification
- `src/components/DataCards.tsx` — stock / comparison / fund / projection / goal cards
- `src/components/ToolSteps.tsx`, `Sparkline.tsx`, `SipCalculator.tsx`, `Logo.tsx`, `Navbar.tsx`
- `public/brand/` — logo (full, mark; light variants for dark backgrounds)
