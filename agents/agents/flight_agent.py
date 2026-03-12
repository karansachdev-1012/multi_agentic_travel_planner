"""Flight Agent — tries Google Flights → search URLs."""
import logging
import urllib.parse
from models import FlightResult
from config import AGENTS
from cache import get_cached, set_cached

logger = logging.getLogger(__name__)


async def run_flight_agent(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str = "",
    passengers: int = 1,
    currency: str = "USD",
) -> list[FlightResult]:
    """Find real flight prices with fallback chain."""
    if not AGENTS["flights"]["enabled"]:
        return []

    cache_key = f"flights:{origin}:{destination}:{departure_date}:{return_date}:{passengers}"
    cached = await get_cached(cache_key)
    if cached:
        logger.info(f"Flight cache hit for {origin} → {destination}")
        return [FlightResult(**f) for f in cached]

    results = []

    # Try Google Flights
    try:
        from scrapers.google_flights import scrape_google_flights
        results = await scrape_google_flights(
            origin, destination, departure_date, return_date,
            passengers, currency,
        )
    except Exception as e:
        logger.warning(f"Google Flights failed: {e}")

    # Final fallback: generate search URLs
    if not results:
        origin_enc = urllib.parse.quote(origin)
        dest_enc = urllib.parse.quote(destination)
        results = [
            FlightResult(
                airline="Search Google Flights",
                source="Search Links",
                booking_url=f"https://www.google.com/travel/flights?q=flights+from+{origin_enc}+to+{dest_enc}+on+{departure_date}",
            ),
            FlightResult(
                airline="Search Kayak",
                source="Search Links",
                booking_url=f"https://www.kayak.com/flights/{origin_enc}-{dest_enc}/{departure_date}/{return_date or ''}",
            ),
            FlightResult(
                airline="Search Skyscanner",
                source="Search Links",
                booking_url=f"https://www.skyscanner.com/transport/flights/{origin_enc}/{dest_enc}/{departure_date.replace('-', '')}/?adults={passengers}",
            ),
        ]

    # Cache successful results
    if results and results[0].source != "Search Links":
        await set_cached(
            cache_key,
            [r.model_dump() for r in results],
            AGENTS["flights"]["cache_hours"],
        )

    return results
