"""Shared async HTTP client."""

import asyncio

import httpx

from backend import config

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"

_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=config.HTTP_TIMEOUT_SECONDS,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
        )
    return _client


async def close():
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def get_json(url: str, params: dict | None = None, attempts: int = 3):
    """GET a JSON endpoint, retrying timeouts and 5xx with a short backoff."""
    for attempt in range(attempts):
        try:
            r = await client().get(url, params=params)
            if r.status_code < 500:
                r.raise_for_status()
                return r.json()
        except (httpx.TimeoutException, httpx.TransportError):
            if attempt == attempts - 1:
                raise
        await asyncio.sleep(0.6 * (attempt + 1))
    r.raise_for_status()
