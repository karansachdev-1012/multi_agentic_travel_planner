"""Seasonal Intelligence Agent wrapper with caching."""
import logging
from models import SeasonalResult
from config import AGENTS
from cache import get_cached, set_cached
from free_apis.seasonal_data import get_seasonal

logger = logging.getLogger(__name__)


async def run_seasonal_agent(
    destination: str, check_in: str, check_out: str, country_code: str = ""
) -> SeasonalResult:
    """Get seasonal intelligence with caching."""
    if not AGENTS["seasonal"]["enabled"]:
        return SeasonalResult(destination=destination, error="Seasonal agent disabled")

    cache_key = f"seasonal:{destination.lower().strip()}:{check_in[:7]}"
    cached = await get_cached(cache_key)
    if cached:
        logger.info(f"Seasonal cache hit for {destination}")
        return SeasonalResult(**cached)

    result = await get_seasonal(destination, check_in, check_out, country_code)

    if not result.error:
        await set_cached(
            cache_key,
            result.model_dump(),
            AGENTS["seasonal"]["cache_hours"],
        )

    return result
