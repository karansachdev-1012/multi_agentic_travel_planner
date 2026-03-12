"""Weather Agent wrapper with caching."""
import logging
from models import WeatherResult
from config import AGENTS
from cache import get_cached, set_cached
from free_apis.open_meteo import get_weather

logger = logging.getLogger(__name__)


async def run_weather_agent(
    location: str, check_in: str, check_out: str
) -> WeatherResult:
    """Get weather forecast with caching."""
    if not AGENTS["weather"]["enabled"]:
        return WeatherResult(location=location, error="Weather agent disabled")

    cache_key = f"weather:{location}:{check_in}:{check_out}"
    cached = await get_cached(cache_key)
    if cached:
        logger.info(f"Weather cache hit for {location}")
        return WeatherResult(**cached)

    result = await get_weather(location, check_in, check_out)

    if result.days and not result.error:
        await set_cached(
            cache_key,
            result.model_dump(),
            AGENTS["weather"]["cache_hours"],
        )

    return result
