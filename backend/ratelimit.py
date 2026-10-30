"""In-memory per-client rate limiting (fine for a single instance; use Redis when scaling out)."""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from backend import config


class RateLimiter:
    def __init__(self, per_minute: int, per_day: int):
        self.per_minute, self.per_day = per_minute, per_day
        self.recent: dict[str, deque] = defaultdict(deque)
        self.daily: dict[str, tuple[str, int]] = {}

    def check(self, key: str):
        now = time.time()
        window = self.recent[key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= self.per_minute:
            raise HTTPException(429, "You're asking questions very quickly — please wait a minute and try again.")

        today = time.strftime("%Y-%m-%d")
        day, count = self.daily.get(key, (today, 0))
        if day != today:
            count = 0
        if count >= self.per_day:
            raise HTTPException(429, "You've reached today's free question limit. Please come back tomorrow.")

        window.append(now)
        self.daily[key] = (today, count + 1)
        if len(self.recent) > 10_000:  # drop idle clients so memory stays bounded
            for k in [k for k, v in self.recent.items() if not v]:
                self.recent.pop(k, None)


limiter = RateLimiter(config.RATE_LIMIT_PER_MINUTE, config.RATE_LIMIT_PER_DAY)


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def rate_limit(request: Request):
    limiter.check(client_key(request))
