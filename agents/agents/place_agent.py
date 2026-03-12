"""Place Agent wrapper with caching."""
import logging
from models import PlaceVerification
from config import AGENTS
from cache import get_cached, set_cached
from free_apis.nominatim import verify_place

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

    result = await verify_place(name, city)

    await set_cached(
        cache_key,
        result.model_dump(),
        AGENTS["places"]["cache_hours"],
    )

    return result
