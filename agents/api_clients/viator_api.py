"""Viator Partner API client.

Docs: https://docs.viator.com/partner-api/technical
Auth: API key passed as exp-api-key header.
"""
import httpx
import logging

from models import ActivityResult

logger = logging.getLogger(__name__)

VIATOR_BASE_URL = "https://api.viator.com/partner"


async def search_activities(
    query: str,
    city: str = "",
    currency: str = "USD",
    max_results: int = 5,
    config: dict = None,
) -> list[ActivityResult]:
    """Search activities via Viator Partner API."""
    if not config or not config.get("key"):
        return []

    headers = {
        "exp-api-key": config["key"],
        "Accept": "application/json;version=2.0",
        "Accept-Language": "en-US",
    }

    search_term = f"{query} {city}".strip()

    payload = {
        "searchTerm": search_term,
        "currency": currency,
        "searchTypes": [{"searchType": "PRODUCTS", "pagination": {"offset": 0, "limit": max_results}}],
    }

    try:
        async with httpx.AsyncClient(timeout=15, headers=headers) as client:
            resp = await client.post(
                f"{VIATOR_BASE_URL}/search/freetext",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        logger.warning(f"Viator API HTTP error: {e.response.status_code}")
        return []

    products = data.get("products", {}).get("results", [])

    results = []
    for product in products[:max_results]:
        price_obj = product.get("pricing", {}).get("summary", {})
        price = price_obj.get("fromPrice")
        try:
            price = float(price) if price else None
        except (ValueError, TypeError):
            price = None

        reviews = product.get("reviews", {})
        rating = reviews.get("combinedAverageRating")
        review_count = reviews.get("totalReviews")

        results.append(ActivityResult(
            name=product.get("title", ""),
            matched_activity=query,
            price=price,
            currency=currency,
            rating=float(rating) if rating else None,
            review_count=int(review_count) if review_count else None,
            source="Viator API",
            booking_url=product.get("productUrl", ""),
            duration=product.get("duration", {}).get("fixedDurationInMinutes", ""),
            image_url="",
        ))

    logger.info(f"Viator API: {len(results)} activities for '{query}'")
    return results
