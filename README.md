# FinSage.ai

An AI research assistant for Indian retail investors. Ask about NSE/BSE stocks, sectors, mutual funds or savings
goals and get a short answer grounded in live market data, AMFI NAVs and Indian business news — with the numbers
shown as cards, the sources linked, and every ₹ / % figure in the answer checked against the fetched data.

- **Frontend** — Next.js 16 + Tailwind (`frontend/`)
- **Backend** — FastAPI + LangGraph (`backend/`)
- **LLM** — any OpenAI-compatible model: Groq (Qwen3.8 27B → GPT-OSS 120B) with Gemini as fallback on the free tier,
  or a local model for development

## How it works

```
Next.js ──SSE──▶ FastAPI /chat/stream ──▶ LangGraph
                                           ├─ tools mode  : data for recognised stocks/funds is fetched first,
                                           │                then the LLM calls any other tools it needs (Groq / Gemini)
                                           └─ guided mode : Python chooses tools, the LLM writes (small local models)
                                                 │
            tools/ (plain Python, no framework) ─┤
              market.py  yfinance quotes, fundamentals, peer comparison (15-min cache)
              funds.py   AMFI NAV history via mfapi.in → 1Y/3Y/5Y CAGR
              news.py    8 Indian business RSS feeds, refreshed every 10 min, searched locally
              calc.py    SIP / lumpsum / goal maths (the LLM never does arithmetic)
              symbols.py company name → NSE symbol, from the official NSE equity list
                                                 │
            agent/verify.py ─ checks every ₹ / % in the answer against the fetched data
```

Answers stream token by token. Tool progress, structured data (stock, comparison, fund, projection cards) and the
verification result are separate events, so the UI shows real progress and real numbers.

## Project layout

```
backend/
  main.py          FastAPI app: /chat/stream (SSE), /chat, /health; CORS, rate limiting, news refresher
  config.py        all settings, from environment variables / backend/.env
  agent/           LangGraph graphs, LLM providers + fallbacks, prompts, router, runner, verify
  tools/           market data, mutual funds, news, calculators, NSE symbol resolution
  data/            bundled NSE equity list
frontend/          Next.js app (see frontend/README.md)
tests/             pytest suite — no network or API keys needed
evals/             question set + scorer for answer quality
render.yaml        Render deployment (API + website)
Experiments/       RAG notebook experiments (not used by the app)
```

## Run locally

Backend (Python 3.11+):

```bash
python -m venv .venv
.venv/Scripts/activate                  # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements-dev.txt
cp backend/.env.example backend/.env    # add GROQ_API_KEY and/or GEMINI_API_KEY
uvicorn backend.main:app --port 8000    # add --reload while developing
```

Without an API key the backend uses a local OpenAI-compatible server at `LOCAL_LLM_URL`
(default `http://localhost:8001/v1`), e.g. llama-cpp-python:

```bash
python -m llama_cpp.server --model llama-3.2-1b-instruct-q4_k_m.gguf --port 8001 --n_ctx 8192
```

Frontend:

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Checks:

```bash
ruff check backend tests evals && ruff format --check backend tests evals
pytest
cd frontend && npm run lint && npm run build
```

## Answer quality

**Figure verification.** After every answer, each ₹ amount and percentage is checked against the data FinSage fetched
for that question. The UI shows "All N figures verified" or lists the figures that didn't come from live data.

**Eval set.** `evals/questions.json` holds 41 Indian-market questions — stocks, comparisons, sectors, funds, SIP maths,
tax concepts, market news and an off-topic one — with the points a good answer must cover.

```bash
python -m evals.run                      # writes evals/results/<timestamp>.md
python -m evals.run --only fund,stock    # a subset
```

To compare with another assistant, copy `evals/external/chatgpt.template.json` to `chatgpt.json`, paste its answers,
and run with `--external evals/external/chatgpt.json`. Its ₹ / % figures are checked against the same live data.

Baseline (Groq free tier, 30 Oct 2026): 89% of 405 figures verified, 95% of answers covered the required points,
100% made no return promises, median answer time 2.6 s. Tax questions are the weakest spot (rates quoted from memory).

## API

| Endpoint | Purpose |
|---|---|
| `POST /chat/stream` | `{query, history}` → server-sent events: `meta`, `tool_start`, `tool_end`, `token`, `text_reset`, `verification`, `done`, `error` |
| `POST /chat` | Same, but waits and returns `{answer, tools, verification, mode, model, error}` |
| `GET /health` | Mode, model chain, cached news count |

Interactive docs at `/docs`.

## Deploying

Both services deploy to Render's free plan from `render.yaml`, with Groq/Gemini free-tier keys.
See [DEPLOY.md](DEPLOY.md).

---

FinSage provides AI-generated information for education only. It is not a SEBI-registered investment adviser.
Investments are subject to market risks.
