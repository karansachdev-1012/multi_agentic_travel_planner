"""Place Agent — tries Google Places API → Nominatim (free) with caching."""
import logging
from models import PlaceVerification
from config import AGENTS
from cache import get_cached, set_cached

logger = logging.getLogger(__name__)


async def run_place_agent(
    name: str, city: str = ""
) -> PlaceVerification:
    """Verify a place exists with caching."""
    if not AGENTS["places"]["enabled"]:
        return PlaceVerification(query=name, found=False)

    cache_key = f"place:{name}:{city}"
    cached = await get_cached(cache_key)
    if cached:
        return PlaceVerification(**cached)

    result = None

    # Priority 1: Google Places API (if configured)
    from api_config import get_google_places_config
    gp_config = get_google_places_config()
    if gp_config["key"]:
        try:
            from api_clients.google_places import verify_place as gp_verify
            result = await gp_verify(name, city, config=gp_config)
        except Exception as e:
            logger.warning(f"Google Places API failed for '{name}' ({e}), falling back to Nominatim")

    # Priority 2: Nominatim (free, no key needed)
    if result is None or not result.found:
        from free_apis.nominatim import verify_place
        result = await verify_place(name, city)

    await set_cached(
        cache_key,
        result.model_dump(),
        AGENTS["places"]["cache_hours"],
    )

    return result
