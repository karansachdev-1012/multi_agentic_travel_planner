"""Shared rate limiting for API calls and scraping."""
import asyncio
import time
from collections import defaultdict

# Per-domain rate limiters
_last_request: dict[str, float] = defaultdict(float)
_locks: dict[str, asyncio.Lock] = {}


async def rate_limit(domain: str, min_delay: float = 1.0):
    """Ensure minimum delay between requests to the same domain."""
    if domain not in _locks:
        _locks[domain] = asyncio.Lock()
    async with _locks[domain]:
        now = time.time()
        elapsed = now - _last_request[domain]
        if elapsed < min_delay:
            await asyncio.sleep(min_delay - elapsed)
        _last_request[domain] = time.time()
