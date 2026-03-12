"""Review Aggregation Agent — fetches ratings for places in the trip plan."""
import logging
from models import ReviewResult
from config import AGENTS
from cache import get_cached, set_cached
from scrapers.google_reviews import scrape_google_reviews

logger = logging.getLogger(__name__)


async def run_review_agent(
    places: list[dict[str, str]],
) -> list[ReviewResult]:
    """Get review data for a list of places with caching.

    Args:
        places: list of {"name": "Place Name", "city": "City"}
    """
    if not AGENTS["reviews"]["enabled"]:
        return []

    max_results = AGENTS["reviews"]["max_results"]
    results = []

    for p in places[:max_results]:
        name = p.get("name", "")
        city = p.get("city", "")
        if not name:
            continue

        cache_key = f"review:{name.lower()}:{city.lower()}"
        cached = await get_cached(cache_key)
        if cached:
            results.append(ReviewResult(**cached))
            continue

        result = await scrape_google_reviews(name, city)

        if not result.error and result.rating is not None:
            await set_cached(
                cache_key,
                result.model_dump(),
                AGENTS["reviews"]["cache_hours"],
            )

        results.append(result)

    logger.info(f"Reviews: {len(results)} places checked, {sum(1 for r in results if r.rating)} with ratings")
    return results
