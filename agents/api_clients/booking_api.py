"""Booking.com Partner API client.

Docs: https://developers.booking.com/api/commercial/index.html
Auth: API key passed as header.
"""
import httpx
import logging
import urllib.parse

from models import HotelResult

logger = logging.getLogger(__name__)

BOOKING_BASE_URL = "https://distribution-xml.booking.com/2.5/json"


async def search_hotels(
    city: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    children: int = 0,
    max_price: float = 0,
    currency: str = "USD",
    config: dict = None,
) -> list[HotelResult]:
    """Search hotels via Booking.com Partner API."""
    if not config or not config.get("key"):
        return []

    headers = {
        "Authorization": f"Basic {config['key']}",
        "Accept": "application/json",
    }

    params = {
        "city": city,
        "checkin": check_in,
        "checkout": check_out,
        "guest_qty": adults,
        "room_qty": 1,
        "currency": currency,
        "rows": 10,
        "languagecode": "en",
    }

    if config.get("affiliate_id"):
        params["affiliate_id"] = config["affiliate_id"]

    try:
        async with httpx.AsyncClient(timeout=15, headers=headers) as client:
            resp = await client.get(f"{BOOKING_BASE_URL}/hotels", params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        logger.warning(f"Booking.com API HTTP error: {e.response.status_code}")
        return []

    hotels = data if isinstance(data, list) else data.get("result", [])

    results = []
    for hotel in hotels[:10]:
        name = hotel.get("hotel_name", hotel.get("name", ""))
        price = hotel.get("min_rate", hotel.get("price"))
        try:
            price = float(price) if price else None
        except (ValueError, TypeError):
            price = None

        rating = hotel.get("review_score")
        try:
            rating = float(rating) / 2 if rating else None  # Booking uses 1-10 scale
        except (ValueError, TypeError):
            rating = None

        review_count = hotel.get("review_nr")
        try:
            review_count = int(review_count) if review_count else None
        except (ValueError, TypeError):
            review_count = None

        if max_price and price and price > max_price:
            continue

        city_enc = urllib.parse.quote(city)
        name_enc = urllib.parse.quote(name)

        results.append(HotelResult(
            name=name,
            price_per_night=price,
            currency=currency,
            rating=rating,
            review_count=review_count,
            source="Booking.com API",
            booking_url=hotel.get("url", f"https://www.booking.com/searchresults.html?ss={city_enc}"),
            image_url=hotel.get("main_photo_url", ""),
            neighborhood=hotel.get("district", ""),
        ))

    logger.info(f"Booking.com API: {len(results)} hotels for {city}")
    return results
