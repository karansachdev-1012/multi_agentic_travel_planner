"""Link Verification Agent — validates URLs with concurrent HEAD requests."""
import asyncio
import httpx
import logging
from models import LinkCheck
from cache import get_cached, set_cached

logger = logging.getLogger(__name__)

MAX_CONCURRENT = 10
TIMEOUT = 8


async def check_link(url: str) -> LinkCheck:
    """Check if a URL is reachable."""
    if not url or not url.startswith("http"):
        return LinkCheck(url=url, reachable=False, error="Invalid URL")

    cache_key = f"link:{url}"
    cached = await get_cached(cache_key)
    if cached:
        return LinkCheck(**cached)

    try:
        async with httpx.AsyncClient(
            timeout=TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "TripMind/2.0 Link Checker"},
        ) as client:
            resp = await client.head(url)
            result = LinkCheck(
                url=url,
                status=resp.status_code,
                reachable=200 <= resp.status_code < 400,
                redirect_url=str(resp.url) if str(resp.url) != url else "",
            )
    except httpx.TimeoutException:
        result = LinkCheck(url=url, reachable=False, error="Timeout")
    except Exception as e:
        result = LinkCheck(url=url, reachable=False, error=str(e)[:100])

    await set_cached(cache_key, result.model_dump(), 24)
    return result


async def run_link_agent(urls: list[str]) -> list[LinkCheck]:
    """Verify multiple URLs concurrently."""
    if not urls:
        return []

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def check_with_semaphore(url: str) -> LinkCheck:
        async with semaphore:
            return await check_link(url)

    results = await asyncio.gather(
        *[check_with_semaphore(url) for url in urls],
        return_exceptions=True,
    )

    checked = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            checked.append(LinkCheck(url=urls[i], reachable=False, error=str(r)[:100]))
        else:
            checked.append(r)

    reachable = sum(1 for r in checked if r.reachable)
    logger.info(f"Link check: {reachable}/{len(checked)} URLs reachable")
    return checked
