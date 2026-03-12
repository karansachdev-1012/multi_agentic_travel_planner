"""Price Trends Agent — estimates flight + hotel costs across 12 months.

Strategy (fast, reliable):
  1. Scrape ONE baseline price for the user's travel month (flights + hotels)
  2. Get tourism seasonality levels (free, instant — peak/shoulder/off-peak)
  3. Apply seasonal multipliers to estimate all 12 months from the baseline
  4. If baseline scrape fails, use route-based estimates

This replaces the old approach of scraping 24 pages (12 months × 2), which was
extremely slow (~3 min) and usually failed due to anti-bot blocking.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from calendar import monthrange

from models import MonthlyPrice, PriceTrendsResult
from config import AGENTS
from cache import get_cached, set_cached

logger = logging.getLogger(__name__)

MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# ── Seasonal price multipliers ───────────────────────────────────────────────
# Based on industry data: peak months cost ~35% more, off-peak ~25% less.
# Shoulder is roughly baseline. These are applied relative to the user's
# actual travel month price, adjusted for that month's own tourism level.
TOURISM_MULTIPLIERS = {
    "peak": 1.35,
    "shoulder": 1.05,
    "off-peak": 0.75,
    "": 1.0,  # unknown tourism level
}

# Finer per-month seasonal shape (1.0 = average). This captures patterns
# like "January is cheap everywhere" and "summer is expensive in Europe".
# Used as a secondary signal when tourism data is sparse.
MONTH_SHAPE_NORTHERN = {
    1: 0.72, 2: 0.75, 3: 0.85, 4: 0.92, 5: 1.00, 6: 1.20,
    7: 1.35, 8: 1.30, 9: 1.05, 10: 0.90, 11: 0.78, 12: 1.10,
}
MONTH_SHAPE_SOUTHERN = {
    1: 1.30, 2: 1.25, 3: 1.05, 4: 0.90, 5: 0.78, 6: 0.72,
    7: 0.70, 8: 0.72, 9: 0.80, 10: 0.90, 11: 1.05, 12: 1.35,
}


def _representative_dates(check_in: str, check_out: str, target_month: int) -> tuple[str, str]:
    """Pick representative check-in/check-out dates in target_month,
    keeping the same trip duration and similar day-of-week as the original."""
    try:
        ci = datetime.strptime(check_in, "%Y-%m-%d")
        co = datetime.strptime(check_out, "%Y-%m-%d")
    except (ValueError, TypeError):
        ci = datetime.now()
        co = ci + timedelta(days=7)

    duration = (co - ci).days or 7
    dow = ci.weekday()

    year = ci.year
    if target_month < ci.month:
        year += 1

    first_day = datetime(year, target_month, 1)
    first_dow_offset = (dow - first_day.weekday()) % 7
    target_day = 1 + first_dow_offset + 7  # 2nd week

    max_day = monthrange(year, target_month)[1]
    target_day = min(target_day, max_day)

    new_ci = datetime(year, target_month, target_day)
    new_co = new_ci + timedelta(days=duration)

    return new_ci.strftime("%Y-%m-%d"), new_co.strftime("%Y-%m-%d")


async def _fetch_baseline_flight(
    origin: str, destination: str, ci: str, co: str,
    passengers: int, currency: str,
) -> float | None:
    """Get a single baseline flight price for the user's travel dates."""
    # Try API first
    from api_config import get_amadeus_config
    config = get_amadeus_config()
    if config["key"] and config["secret"]:
        try:
            from api_clients.amadeus import search_flights
            results = await asyncio.wait_for(
                search_flights(origin, destination, ci, co, passengers, currency, config),
                timeout=20,
            )
            prices = [r.price for r in results if r.price and r.price > 20]
            if prices:
                return min(prices)
        except Exception as e:
            logger.warning(f"Price trends baseline flight API failed: {e}")

    # Fall back to scraper
    try:
        from scrapers.google_flights import scrape_google_flights
        results = await asyncio.wait_for(
            scrape_google_flights(origin, destination, ci, co, passengers, currency),
            timeout=35,
        )
        prices = [r.price for r in results if r.price and r.price > 20]
        if prices:
            return min(prices)
    except Exception as e:
        logger.warning(f"Price trends baseline flight scrape failed: {e}")

    return None


async def _fetch_baseline_hotel(
    city: str, ci: str, co: str, adults: int, currency: str,
) -> float | None:
    """Get a single baseline hotel price for the user's travel dates."""
    # Try API first
    from api_config import get_booking_config
    config = get_booking_config()
    if config["key"]:
        try:
            from api_clients.booking_api import search_hotels
            results = await asyncio.wait_for(
                search_hotels(city, ci, co, adults, 0, 0, currency, config),
                timeout=20,
            )
            prices = [r.price_per_night for r in results if r.price_per_night and r.price_per_night > 10]
            if prices:
                return round(sum(prices) / len(prices), 2)
        except Exception as e:
            logger.warning(f"Price trends baseline hotel API failed: {e}")

    # Fall back to scraper
    try:
        from scrapers.google_hotels import scrape_google_hotels
        results = await asyncio.wait_for(
            scrape_google_hotels(city, ci, co, adults, 0, currency, max_results=5),
            timeout=35,
        )
        prices = [r.price_per_night for r in results if r.price_per_night and r.price_per_night > 10]
        if prices:
            return round(sum(prices) / len(prices), 2)
    except Exception as e:
        logger.warning(f"Price trends baseline hotel scrape failed: {e}")

    return None


def _estimate_prices(
    baseline: float | None,
    travel_month: int,
    tourism: dict[int, str],
    is_southern: bool,
    fallback_baseline: float,
) -> list[float]:
    """Estimate 12 months of prices from a single baseline using seasonal multipliers.

    Returns a list of 12 floats (index 0 = January).
    """
    base = baseline if baseline else fallback_baseline
    month_shape = MONTH_SHAPE_SOUTHERN if is_southern else MONTH_SHAPE_NORTHERN

    # The baseline price corresponds to the travel_month.
    # Normalize so that the travel_month multiplier maps to the baseline.
    travel_tourism = tourism.get(travel_month, "")
    travel_multiplier = TOURISM_MULTIPLIERS.get(travel_tourism, 1.0)
    travel_shape = month_shape.get(travel_month, 1.0)
    # Combined travel month factor
    travel_factor = (travel_multiplier + travel_shape) / 2

    prices = []
    for month in range(1, 13):
        m_tourism = tourism.get(month, "")
        m_multiplier = TOURISM_MULTIPLIERS.get(m_tourism, 1.0)
        m_shape = month_shape.get(month, 1.0)
        # Blend tourism-specific and generic seasonal shape
        m_factor = (m_multiplier + m_shape) / 2

        # Scale relative to travel month
        ratio = m_factor / travel_factor if travel_factor else 1.0
        estimated = round(base * ratio, 2)
        prices.append(estimated)

    return prices


async def run_price_trends_agent(
    origin: str,
    destination: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    children: int = 0,
    currency: str = "USD",
    country_code: str = "",
) -> PriceTrendsResult:
    """Estimate flight + hotel prices for all 12 months using baseline + seasonal multipliers."""
    if not AGENTS.get("price_trends", {}).get("enabled", True):
        return PriceTrendsResult(
            origin=origin, destination=destination, currency=currency,
            error="Price trends agent disabled",
        )

    # Check cache — skip stale entries with all-null prices
    cache_key = f"ptrends:{origin}:{destination}:{adults}:{children}"
    cached = await get_cached(cache_key)
    if cached:
        mp = cached.get("monthly_prices", [])
        has_prices = any(
            m.get("avg_flight_price") is not None or m.get("avg_hotel_price") is not None
            for m in mp
        )
        if has_prices:
            logger.info(f"Price trends cache hit for {origin} → {destination}")
            return PriceTrendsResult(**cached)
        else:
            logger.info(f"Price trends cache has null prices, re-computing for {origin} → {destination}")

    # Get tourism levels (instant, free)
    try:
        from free_apis.seasonal_data import get_all_tourism_levels
        tourism = get_all_tourism_levels(country_code)
    except Exception as e:
        logger.warning(f"Failed to get tourism levels: {e}")
        tourism = {m: "" for m in range(1, 13)}

    travel_month = datetime.strptime(check_in, "%Y-%m-%d").month
    passengers = adults + children

    # Determine hemisphere from country code (rough heuristic)
    southern_countries = {"AU", "NZ", "AR", "CL", "BR", "ZA", "PE", "CO", "ID", "KE", "TZ"}
    is_southern = country_code.upper() in southern_countries

    # ── Step 1: Fetch baseline prices (travel month only — 2 scrapes max) ──
    logger.info(f"Price trends: fetching baseline for {origin} → {destination} ({check_in})")
    baseline_flight, baseline_hotel = await asyncio.gather(
        _fetch_baseline_flight(origin, destination, check_in, check_out, passengers, currency),
        _fetch_baseline_hotel(destination, check_in, check_out, adults, currency),
    )
    logger.info(f"Price trends baseline: flight={baseline_flight}, hotel={baseline_hotel}")

    # ── Step 2: Estimate 12 months using seasonal multipliers ──
    # Fallback baselines if scraping failed (reasonable per-person estimates)
    flight_prices = _estimate_prices(
        baseline_flight, travel_month, tourism, is_southern,
        fallback_baseline=450,  # ~average domestic round-trip
    )
    hotel_prices = _estimate_prices(
        baseline_hotel, travel_month, tourism, is_southern,
        fallback_baseline=120,  # ~average hotel per night
    )

    # ── Step 3: Build result ──
    monthly_prices = []
    for i, month in enumerate(range(1, 13)):
        monthly_prices.append(MonthlyPrice(
            month=month,
            month_name=MONTH_NAMES[month],
            avg_flight_price=round(flight_prices[i], 2),
            avg_hotel_price=round(hotel_prices[i], 2),
            tourism_level=tourism.get(month, ""),
        ))

    result = PriceTrendsResult(
        origin=origin,
        destination=destination,
        currency=currency,
        monthly_prices=monthly_prices,
        travel_month=travel_month,
    )

    # Cache results
    await set_cached(
        cache_key,
        result.model_dump(),
        AGENTS.get("price_trends", {}).get("cache_hours", 24),
    )

    has_real = baseline_flight is not None or baseline_hotel is not None
    logger.info(
        f"Price trends: {'real baseline' if has_real else 'estimated baseline'} "
        f"for {origin} → {destination}"
    )
    return result
