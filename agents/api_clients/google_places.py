"""Google Places API (New) client for reviews and place verification.

Docs: https://developers.google.com/maps/documentation/places/web-service
Auth: API key passed as query parameter or header.
"""
import httpx
import logging

from models import PlaceVerification, ReviewResult

logger = logging.getLogger(__name__)

PLACES_BASE_URL = "https://places.googleapis.com/v1"


async def verify_place(
    place_name: str,
    city: str = "",
    config: dict = None,
) -> PlaceVerification:
    """Verify a place exists using Google Places Text Search."""
    if not config or not config.get("key"):
        return PlaceVerification(query=place_name, found=False)

    query = f"{place_name} {city}".strip()

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config["key"],
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.types,places.googleMapsUri",
    }

    try:
        async with httpx.AsyncClient(timeout=10, headers=headers) as client:
            resp = await client.post(
                f"{PLACES_BASE_URL}/places:searchText",
                json={"textQuery": query, "maxResultCount": 1},
            )
            resp.raise_for_status()
            places = resp.json().get("places", [])
    except Exception as e:
        logger.warning(f"Google Places verify failed for '{query}': {e}")
        return PlaceVerification(query=place_name, found=False)

    if not places:
        return PlaceVerification(query=place_name, found=False)

    place = places[0]
    loc = place.get("location", {})
    lat = loc.get("latitude")
    lon = loc.get("longitude")

    return PlaceVerification(
        query=place_name,
        found=True,
        name=place.get("displayName", {}).get("text", place_name)[:120],
        lat=lat,
        lon=lon,
        address=place.get("formattedAddress", ""),
        place_type=", ".join(place.get("types", [])[:2]),
        maps_url=place.get("googleMapsUri", f"https://www.google.com/maps/search/?api=1&query={lat},{lon}" if lat else ""),
        confidence=0.9,
    )


async def get_place_reviews(
    place_name: str,
    city: str = "",
    config: dict = None,
) -> ReviewResult:
    """Get place reviews using Google Places API."""
    if not config or not config.get("key"):
        return ReviewResult(place_name=place_name, city=city)

    query = f"{place_name} {city}".strip()

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config["key"],
        "X-Goog-FieldMask": "places.displayName,places.rating,places.userRatingCount,places.reviews,places.googleMapsUri,places.primaryType",
    }

    try:
        async with httpx.AsyncClient(timeout=10, headers=headers) as client:
            resp = await client.post(
                f"{PLACES_BASE_URL}/places:searchText",
                json={"textQuery": query, "maxResultCount": 1},
            )
            resp.raise_for_status()
            places = resp.json().get("places", [])
    except Exception as e:
        logger.warning(f"Google Places reviews failed for '{query}': {e}")
        return ReviewResult(place_name=place_name, city=city)

    if not places:
        return ReviewResult(place_name=place_name, city=city)

    place = places[0]
    rating = place.get("rating")
    review_count = place.get("userRatingCount")

    snippets = []
    for review in place.get("reviews", [])[:3]:
        text = review.get("text", {}).get("text", "")
        if text:
            snippets.append(text[:200])

    return ReviewResult(
        place_name=place_name,
        city=city,
        rating=float(rating) if rating else None,
        review_count=int(review_count) if review_count else None,
        category=place.get("primaryType", ""),
        snippets=snippets,
        maps_url=place.get("googleMapsUri", ""),
        source="Google Places API",
    )
