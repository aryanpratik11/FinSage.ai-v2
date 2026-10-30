"""Runtime configuration, read from environment variables (and backend/.env if present)."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")


def _env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    return value.strip() if value and value.strip() else default


def _int(name: str, default: int) -> int:
    try:
        return int(_env(name, str(default)))
    except ValueError:
        return default


# ── LLM providers ─────────────────────────────────────────────────────────────
# Any provider with a key is used; the first available is primary, the rest are
# fallbacks. All three speak the OpenAI chat-completions API.
GROQ_API_KEY = _env("GROQ_API_KEY")
GROQ_MODEL = _env("GROQ_MODEL", "qwen/qwen3.8-27b")
# Second Groq model tried before Gemini (Groq rate limits and outages are per model). "off" disables it.
GROQ_FALLBACK_MODEL = _env("GROQ_FALLBACK_MODEL", "openai/gpt-oss-120b")

GEMINI_API_KEY = _env("GEMINI_API_KEY")
GEMINI_MODEL = _env("GEMINI_MODEL", "gemini-flash-latest")

# Local OpenAI-compatible server (llama-cpp-python, Ollama, LM Studio…). Set to "off" to disable.
LOCAL_LLM_URL = _env("LOCAL_LLM_URL", "http://localhost:8001/v1")
LOCAL_LLM_MODEL = _env("LOCAL_LLM_MODEL", "local")

# "auto": tool-calling agent when a hosted model is available, guided pipeline otherwise.
# "tools" / "guided" force a mode.
AGENT_MODE = _env("AGENT_MODE", "auto")

# Per model call. Hosted models answer in seconds; a stalled one should hand over to the fallback quickly.
HOSTED_LLM_TIMEOUT_SECONDS = _int("HOSTED_LLM_TIMEOUT_SECONDS", 30)
LLM_TIMEOUT_SECONDS = _int("LLM_TIMEOUT_SECONDS", 120)
MAX_TOOL_ROUNDS = _int("MAX_TOOL_ROUNDS", 4)

# ── API ───────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    o.strip()
    for o in (_env("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001") or "").split(",")
    if o.strip()
]
# Optional regex for extra origins, e.g. Vercel preview deployments: https://finsage-[a-z0-9-]+\.vercel\.app
ALLOWED_ORIGIN_REGEX = _env("ALLOWED_ORIGIN_REGEX")
RATE_LIMIT_PER_MINUTE = _int("RATE_LIMIT_PER_MINUTE", 10)
RATE_LIMIT_PER_DAY = _int("RATE_LIMIT_PER_DAY", 150)
REQUEST_TIMEOUT_SECONDS = _int("REQUEST_TIMEOUT_SECONDS", 180)
MAX_QUERY_CHARS = _int("MAX_QUERY_CHARS", 1000)
MAX_HISTORY_MESSAGES = _int("MAX_HISTORY_MESSAGES", 8)

# ── Data ──────────────────────────────────────────────────────────────────────
NEWS_REFRESH_MINUTES = _int("NEWS_REFRESH_MINUTES", 10)
MARKET_CACHE_SECONDS = _int("MARKET_CACHE_SECONDS", 900)
HTTP_TIMEOUT_SECONDS = _int("HTTP_TIMEOUT_SECONDS", 15)
