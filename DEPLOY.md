# Deploying FinSage on Render (free)

`render.yaml` describes two free Render web services:

| Service | What | Address |
|---|---|---|
| `finsage-api` | FastAPI backend, built from `Dockerfile` | `https://finsage-api.onrender.com` |
| `finsage-web` | Next.js frontend, from `frontend/` | `https://finsage-web.onrender.com` |

## 1. Get LLM keys (free)

- **Groq** → https://console.groq.com/keys. Default models: `qwen/qwen3.8-27b`, falling back to `openai/gpt-oss-120b`.
  Groq retires models from time to time — if one disappears, pick another from its model list and set `GROQ_MODEL`.
- **Gemini** (optional last fallback) → https://aistudio.google.com/apikey.

Keys never go in the repo: locally they're in `backend/.env` (git-ignored); on Render they're environment variables.

## 2. Deploy

1. Push the repo to GitHub.
2. Render dashboard → **New → Blueprint** → connect GitHub → pick the repo → Render reads `render.yaml`.
3. Enter `GROQ_API_KEY` and `GEMINI_API_KEY` when asked → **Apply**. Both services build (the first build takes a few
   minutes).
4. Open `https://finsage-api.onrender.com/health` — expect `"status": "ok"` and `"mode": "tools"`.
5. Open `https://finsage-web.onrender.com/chat` and ask a question.

**If Render assigned different addresses** (it adds a suffix when a name is taken):
- set the website's `NEXT_PUBLIC_API_URL` to the API's actual URL, then **Manual Deploy → Clear build cache & deploy**
  (it's baked in at build time);
- the API already accepts any `finsage-web-xxxx.onrender.com` origin. For a custom domain, add it to the API's
  `ALLOWED_ORIGINS` (comma-separated).

Every push to the repo's default branch redeploys both services.

## Free-plan behaviour

- Services **sleep after ~15 minutes** without traffic; the next visit takes ~30–60 s to wake. Open the API's
  `/health` first before a demo.
- Free instance hours are shared across your workspace, so keeping both services awake 24/7 won't fit — let them sleep.
- Groq's free tier allows roughly one or two answers per minute per model; the fallback chain (second Groq model,
  then Gemini) covers short bursts.

## Alternative: frontend on Vercel

Vercel's free plan doesn't sleep, which makes the site feel faster. Import the repo at https://vercel.com/new, set
**Root Directory** to `frontend` and `NEXT_PUBLIC_API_URL` to the Render API URL, then add the Vercel URL to the API's
`ALLOWED_ORIGINS` on Render. You can then delete the `finsage-web` service.

## Known limits

- **Yahoo Finance** sometimes rate-limits cloud IPs. Quotes are cached for 15 minutes; if a lookup fails, the answer
  says the data is unavailable instead of guessing.
- **Rate limits** are in-memory per instance (`RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_PER_DAY`).
- **NSE symbol list** is bundled at `backend/data/nse_equity.csv`. Refresh it occasionally from
  https://archives.nseindia.com/content/equities/EQUITY_L.csv.
