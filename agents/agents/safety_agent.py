"""Safety Agent wrapper with caching."""
import logging
from models import SafetyResult
from config import AGENTS
from cache import get_cached, set_cached
from free_apis.travel_advisories import get_safety

logger = logging.getLogger(__name__)


async def run_safety_agent(destination: str, passport_country: str = "") -> SafetyResult:
    """Get travel safety data with caching."""
    if not AGENTS["safety"]["enabled"]:
        return SafetyResult(destination=destination, error="Safety agent disabled")

    cache_key = f"safety:{destination.lower().strip()}:{passport_country.lower().strip()}"
    cached = await get_cached(cache_key)
    if cached:
        logger.info(f"Safety cache hit for {destination}")
        return SafetyResult(**cached)

    result = await get_safety(destination, passport_country=passport_country)

    if not result.error:
        await set_cached(
            cache_key,
            result.model_dump(),
            AGENTS["safety"]["cache_hours"],
        )

    return result
