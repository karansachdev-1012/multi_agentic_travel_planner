"""Currency Agent wrapper with caching."""
import logging
from models import CurrencyResult
from config import AGENTS
from cache import get_cached, set_cached
from free_apis.frankfurter import get_rates

logger = logging.getLogger(__name__)


async def run_currency_agent(
    base_currency: str, destinations: list[str]
) -> CurrencyResult:
    """Get exchange rates with caching."""
    if not AGENTS["currency"]["enabled"]:
        return CurrencyResult(base=base_currency, error="Currency agent disabled")

    cache_key = f"currency:{base_currency}:{','.join(sorted(destinations))}"
    cached = await get_cached(cache_key)
    if cached:
        logger.info(f"Currency cache hit for {base_currency}")
        return CurrencyResult(**cached)

    result = await get_rates(base_currency, destinations)

    if result.rates and not result.error:
        await set_cached(
            cache_key,
            result.model_dump(),
            AGENTS["currency"]["cache_hours"],
        )

    return result
