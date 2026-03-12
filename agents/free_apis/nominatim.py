"""Place verification using Nominatim / OpenStreetMap (free, 1 req/sec)."""
import httpx
import logging
import asyncio
from models import PlaceVerification
from utils.rate_limiter import rate_limit

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "TripMind/2.0 (travel-planner-app)"}


def clean_place_name(name: str) -> str:
    """Strip common prefixes like 'Visit', 'Explore', 'Tour of' etc."""
    import re
    prefixes = r'^(visit|explore|tour of|tour|see|discover|walk through|walk to|check out|experience|enjoy|take a)\s+'
    cleaned = re.sub(prefixes, '', name, flags=re.IGNORECASE).strip()
    return cleaned or name


async def verify_place(query: str, near_city: str = "") -> PlaceVerification:
    """Verify a place exists using Nominatim geocoding."""
    try:
        await rate_limit("nominatim", min_delay=1.1)  # respect 1 req/sec

        cleaned = clean_place_name(query)
        search_query = f"{cleaned}, {near_city}" if near_city else cleaned

        async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={
                    "q": search_query,
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 1,
                },
            )
            resp.raise_for_status()
            results = resp.json()

        if not results:
            return PlaceVerification(query=query, found=False)

        result = results[0]
        lat = float(result.get("lat", 0))
        lon = float(result.get("lon", 0))

        # Build readable address
        address_parts = result.get("address", {})
        address = ", ".join(
            filter(
                None,
                [
                    address_parts.get("road", ""),
                    address_parts.get("suburb", "")
                    or address_parts.get("neighbourhood", ""),
                    address_parts.get("city", "")
                    or address_parts.get("town", "")
                    or address_parts.get("village", ""),
                    address_parts.get("country", ""),
                ],
            )
        )

        # Confidence based on importance score (0-1 from Nominatim)
        importance = float(result.get("importance", 0))
        place_type = result.get("type", result.get("class", "unknown"))

        maps_url = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"

        return PlaceVerification(
            query=query,
            found=True,
            name=result.get("display_name", query)[:120],
            lat=lat,
            lon=lon,
            address=address,
            place_type=place_type,
            maps_url=maps_url,
            confidence=min(importance * 1.5, 1.0),
        )

    except Exception as e:
        logger.error(f"Place verification error for '{query}': {e}")
        return PlaceVerification(query=query, found=False)


async def verify_places(
    queries: list[dict[str, str]],
) -> list[PlaceVerification]:
    """Verify multiple places. Each query is {name, city}."""
    results = []
    for q in queries:
        result = await verify_place(q.get("name", ""), q.get("city", ""))
        results.append(result)
    return results
