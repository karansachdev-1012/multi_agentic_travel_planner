"""Amadeus Flight Offers Search API client.

Docs: https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search
Auth: OAuth2 client_credentials grant — token cached for 25 minutes.
"""
import httpx
import logging
import time

from models import FlightResult

logger = logging.getLogger(__name__)

# In-memory token cache
_token: str = ""
_token_expires: float = 0.0


async def _get_token(config: dict) -> str:
    """Exchange client credentials for a bearer token (cached ~25 min)."""
    global _token, _token_expires
    if _token and time.time() < _token_expires:
        return _token

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{config['base_url']}/v1/security/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": config["key"],
                "client_secret": config["secret"],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        _token = data["access_token"]
        _token_expires = time.time() + data.get("expires_in", 1799) - 60
        return _token


async def _resolve_iata(city_name: str, token: str, base_url: str) -> str:
    """Resolve a city/airport name to an IATA code via Amadeus locations API."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{base_url}/v1/reference-data/locations",
            params={"subType": "CITY,AIRPORT", "keyword": city_name, "page[limit]": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        if data:
            return data[0]["iataCode"]
    return city_name[:3].upper()


async def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str = "",
    passengers: int = 1,
    currency: str = "USD",
    config: dict = None,
) -> list[FlightResult]:
    """Search flights via Amadeus Flight Offers Search v2."""
    if not config or not config.get("key") or not config.get("secret"):
        return []

    token = await _get_token(config)
    base = config["base_url"]

    origin_iata = await _resolve_iata(origin, token, base)
    dest_iata = await _resolve_iata(destination, token, base)

    params = {
        "originLocationCode": origin_iata,
        "destinationLocationCode": dest_iata,
        "departureDate": departure_date,
        "adults": passengers,
        "currencyCode": currency,
        "max": 5,
    }
    if return_date:
        params["returnDate"] = return_date

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{base}/v2/shopping/flight-offers",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        offers = resp.json().get("data", [])

    results = []
    for offer in offers[:5]:
        segments = offer.get("itineraries", [{}])[0].get("segments", [])
        first_seg = segments[0] if segments else {}
        last_seg = segments[-1] if segments else {}

        carrier = first_seg.get("carrierCode", "")
        price = float(offer.get("price", {}).get("total", 0))
        dep_time = first_seg.get("departure", {}).get("at", "")
        arr_time = last_seg.get("arrival", {}).get("at", "")
        duration = offer.get("itineraries", [{}])[0].get("duration", "")
        stops = len(segments) - 1

        # Clean ISO duration (PT8H45M → 8h 45m)
        dur_str = duration.replace("PT", "").replace("H", "h ").replace("M", "m").strip()

        results.append(FlightResult(
            airline=carrier,
            price=price if price > 0 else None,
            currency=currency,
            departure_time=dep_time,
            arrival_time=arr_time,
            duration=dur_str,
            stops=stops,
            source="Amadeus",
            booking_url=f"https://www.google.com/travel/flights?q=flights+from+{origin_iata}+to+{dest_iata}+on+{departure_date}",
        ))

    logger.info(f"Amadeus: {len(results)} flights for {origin_iata} → {dest_iata}")
    return results
