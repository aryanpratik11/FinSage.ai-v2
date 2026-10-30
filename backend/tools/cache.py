"""Tiny async TTL cache with request coalescing (concurrent callers share one fetch)."""

import asyncio
import functools
import time
from collections import OrderedDict


def ttl_cache(seconds: int, maxsize: int = 512):
    def decorator(fn):
        store: OrderedDict = OrderedDict()
        inflight: dict = {}

        @functools.wraps(fn)
        async def wrapper(*args):
            hit = store.get(args)
            if hit and hit[1] > time.monotonic():
                return hit[0]

            task = inflight.get(args)
            if task is None:
                task = asyncio.ensure_future(fn(*args))
                inflight[args] = task
                try:
                    value = await task
                finally:
                    inflight.pop(args, None)
                store[args] = (value, time.monotonic() + seconds)
                store.move_to_end(args)
                while len(store) > maxsize:
                    store.popitem(last=False)
                return value
            return await asyncio.shield(task)

        def cache_clear():
            store.clear()
            inflight.clear()

        wrapper.cache_clear = cache_clear
        return wrapper

    return decorator
