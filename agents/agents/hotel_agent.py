"""Hotel Agent — tries Booking.com API → Google Hotels scraper → Booking.com scraper → search URLs."""
import logging
import urllib.parse
from models import HotelResult
from config import AGENTS
from cache import get_cached, set_cached

logger = logging.getLogger(__name__)


async def run_hotel_agent(
    city: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    children: int = 0,
    max_price: float = 0,
    currency: str = "USD",
) -> list[HotelResult]:
    """Find real hotel prices with fallback chain."""
    if not AGENTS["hotels"]["enabled"]:
        return []

    cache_key = f"hotels:{city}:{check_in}:{check_out}:{adults}:{children}:{max_price}"
    cached = await get_cached(cache_key)
    if cached:
        logger.info(f"Hotels cache hit for {city}")
        return [HotelResult(**h) for h in cached]

    results = []

    # Priority 1: Booking.com Partner API (if configured)
    from api_config import get_booking_config
    config = get_booking_config()
    if config["key"]:
        try:
            from api_clients.booking_api import search_hotels
            results = await search_hotels(
                city, check_in, check_out, adults, children,
                max_price, currency, config,
            )
        except Exception as e:
            logger.warning(f"Booking.com API failed ({e}), falling back to scraper")

    # Priority 2: Google Hotels scraper
    if not results:
        try:
            from scrapers.google_hotels import scrape_google_hotels
            results = await scrape_google_hotels(
                city, check_in, check_out, adults, max_price, currency,
                children=children,
            )
        except Exception as e:
            logger.warning(f"Google Hotels failed for {city}: {e}")

    # Priority 3: Booking.com scraper
    if not results:
        try:
            from scrapers.booking_com import scrape_booking
            results = await scrape_booking(
                city, check_in, check_out, adults, max_price, currency,
                children=children,
            )
        except Exception as e:
            logger.warning(f"Booking.com scraper failed for {city}: {e}")

    children_param = f"&group_children={children}" if children > 0 else ""
    # Final fallback: generate search URLs (never fails)
    if not results:
        results = [
            HotelResult(
                name=f"Hotels in {city}",
                source="Search Links",
                booking_url=f"https://www.booking.com/searchresults.html?ss={urllib.parse.quote(city)}&checkin={check_in}&checkout={check_out}&group_adults={adults}{children_param}",
            ),
            HotelResult(
                name=f"Vacation Rentals in {city}",
                source="Search Links",
                booking_url=f"https://www.airbnb.com/s/{urllib.parse.quote(city)}/homes?checkin={check_in}&checkout={check_out}&adults={adults}&children={children}",
            ),
        ]

    # Cache successful results
    if results and results[0].source != "Search Links":
        await set_cached(
            cache_key,
            [r.model_dump() for r in results],
            AGENTS["hotels"]["cache_hours"],
        )

    return results
