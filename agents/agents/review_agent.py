"""Review Aggregation Agent — tries Google Places API → Google Search scraper."""
import logging
from models import ReviewResult
from config import AGENTS
from cache import get_cached, set_cached

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

    # Determine which backend to use
    from api_config import get_google_places_config
    gp_config = get_google_places_config()
    use_api = bool(gp_config["key"])

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

        result = None

        # Priority 1: Google Places API (if configured)
        if use_api:
            try:
                from api_clients.google_places import get_place_reviews
                result = await get_place_reviews(name, city, config=gp_config)
            except Exception as e:
                logger.warning(f"Google Places API failed for '{name}' ({e}), falling back to scraper")

        # Priority 2: Google Search scraper
        if result is None or (result.rating is None and result.error):
            try:
                from scrapers.google_reviews import scrape_google_reviews
                result = await scrape_google_reviews(name, city)
            except Exception as e:
                logger.warning(f"Google Reviews scraper failed for '{name}': {e}")
                result = ReviewResult(place_name=name, city=city, error=str(e))

        if not result.error and result.rating is not None:
            await set_cached(
                cache_key,
                result.model_dump(),
                AGENTS["reviews"]["cache_hours"],
            )

        results.append(result)

    logger.info(f"Reviews: {len(results)} places checked, {sum(1 for r in results if r.rating)} with ratings")
    return results
