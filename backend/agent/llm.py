"""Chat models. Groq, Gemini and local servers all speak the OpenAI API, so one client covers them."""

from dataclasses import dataclass

from langchain_openai import ChatOpenAI

from backend import config


@dataclass(frozen=True)
class Provider:
    name: str
    model: str
    base_url: str
    api_key: str
    hosted: bool


def available_providers() -> list[Provider]:
    providers = []
    if config.GROQ_API_KEY:
        groq_url = "https://api.groq.com/openai/v1"
        providers.append(Provider("groq", config.GROQ_MODEL, groq_url, config.GROQ_API_KEY, True))
        fallback = config.GROQ_FALLBACK_MODEL
        if fallback and fallback.lower() not in ("off", "none", "false") and fallback != config.GROQ_MODEL:
            providers.append(Provider("groq", fallback, groq_url, config.GROQ_API_KEY, True))
    if config.GEMINI_API_KEY:
        providers.append(
            Provider(
                "gemini",
                config.GEMINI_MODEL,
                "https://generativelanguage.googleapis.com/v1beta/openai/",
                config.GEMINI_API_KEY,
                True,
            )
        )
    if config.LOCAL_LLM_URL and config.LOCAL_LLM_URL.lower() not in ("off", "none", "false"):
        providers.append(Provider("local", config.LOCAL_LLM_MODEL, config.LOCAL_LLM_URL, "not-needed", False))
    return providers


def chat_model(p: Provider, max_tokens: int = 1600) -> ChatOpenAI:
    return ChatOpenAI(
        model=p.model,
        base_url=p.base_url,
        api_key=p.api_key,
        temperature=0.2,
        max_tokens=max_tokens,
        timeout=config.HOSTED_LLM_TIMEOUT_SECONDS if p.hosted else config.LLM_TIMEOUT_SECONDS,
        # Hosted: no client retries, so a 429 or outage moves straight to the next model in the fallback chain.
        max_retries=0 if p.hosted else 1,
        streaming=True,
        stream_usage=False,
    )


def with_fallbacks(models: list):
    return models[0] if len(models) == 1 else models[0].with_fallbacks(models[1:])
