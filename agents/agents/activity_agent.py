"""Activity Agent — tries Viator → GetYourGuide → search URLs."""
import logging
import urllib.parse
from models import ActivityResult
from config import AGENTS
from cache import get_cached, set_cached

logger = logging.getLogger(__name__)


async def run_activity_agent(
    activity_name: str,
    city: str,
    currency: str = "USD",
) -> list[ActivityResult]:
    """Find real activity prices with fallback chain."""
    if not AGENTS["activities"]["enabled"]:
        return []

    cache_key = f"activity:{activity_name}:{city}"
    cached = await get_cached(cache_key)
    if cached:
        logger.info(f"Activity cache hit for '{activity_name}' in {city}")
        return [ActivityResult(**a) for a in cached]

    results = []

    # Try Viator first
    try:
        from scrapers.viator import scrape_viator
        results = await scrape_viator(activity_name, city, max_results=3, currency=currency)
    except Exception as e:
        logger.warning(f"Viator failed for '{activity_name}': {e}")

    # Try GetYourGuide as supplement/fallback
    try:
        from scrapers.getyourguide import scrape_getyourguide
        gyg_results = await scrape_getyourguide(
            activity_name, city, max_results=2, currency=currency
        )
        if not results:
            results = gyg_results
        else:
            # Merge — add GYG results that don't duplicate Viator
            existing_names = {r.name.lower() for r in results}
            for r in gyg_results:
                if r.name.lower() not in existing_names:
                    results.append(r)
    except Exception as e:
        logger.warning(f"GetYourGuide failed for '{activity_name}': {e}")

    # Final fallback: search URLs
    if not results:
        results = [
            ActivityResult(
                name=activity_name,
                matched_activity=activity_name,
                source="Search Links",
                booking_url=f"https://www.viator.com/searchResults/all?text={urllib.parse.quote(activity_name + ' ' + city)}",
            ),
        ]

    # Cache successful results
    if results and results[0].source != "Search Links":
        await set_cached(
            cache_key,
            [r.model_dump() for r in results],
            AGENTS["activities"]["cache_hours"],
        )

    return results
