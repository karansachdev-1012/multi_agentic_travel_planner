"""Currency agent using Frankfurter API (free, no key, ECB rates)."""
import httpx
import logging
from models import CurrencyRate, CurrencyResult

logger = logging.getLogger(__name__)

# Common destination currencies
COMMON_CURRENCIES = [
    "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "INR", "SGD", "AED",
    "THB", "MXN", "BRL", "ZAR", "NZD", "SEK", "NOK", "DKK", "CZK",
    "PLN", "HUF", "TRY", "IDR", "MYR", "PHP", "KRW", "TWD", "HKD",
    "COP", "PEN", "CLP", "ARS", "ILS", "EGP", "MAD", "ISK", "HRK",
]

# Map destinations to their likely currency
DESTINATION_CURRENCIES = {
    "japan": "JPY", "tokyo": "JPY", "osaka": "JPY", "kyoto": "JPY",
    "uk": "GBP", "london": "GBP", "england": "GBP", "scotland": "GBP",
    "europe": "EUR", "france": "EUR", "paris": "EUR", "germany": "EUR",
    "italy": "EUR", "rome": "EUR", "spain": "EUR", "barcelona": "EUR",
    "greece": "EUR", "portugal": "EUR", "netherlands": "EUR",
    "thailand": "THB", "bangkok": "THB", "phuket": "THB",
    "india": "INR", "mumbai": "INR", "delhi": "INR", "goa": "INR",
    "australia": "AUD", "sydney": "AUD", "melbourne": "AUD",
    "canada": "CAD", "toronto": "CAD", "vancouver": "CAD",
    "mexico": "MXN", "cancun": "MXN",
    "brazil": "BRL", "rio": "BRL",
    "south africa": "ZAR", "cape town": "ZAR",
    "singapore": "SGD",
    "dubai": "AED", "uae": "AED", "abu dhabi": "AED",
    "switzerland": "CHF", "zurich": "CHF",
    "turkey": "TRY", "istanbul": "TRY",
    "indonesia": "IDR", "bali": "IDR",
    "malaysia": "MYR", "kuala lumpur": "MYR",
    "philippines": "PHP", "manila": "PHP",
    "south korea": "KRW", "seoul": "KRW",
    "taiwan": "TWD", "taipei": "TWD",
    "hong kong": "HKD",
    "colombia": "COP", "bogota": "COP",
    "peru": "PEN", "lima": "PEN", "cusco": "PEN",
    "chile": "CLP", "santiago": "CLP",
    "argentina": "ARS", "buenos aires": "ARS",
    "israel": "ILS", "tel aviv": "ILS",
    "egypt": "EGP", "cairo": "EGP",
    "morocco": "MAD", "marrakech": "MAD",
    "iceland": "ISK", "reykjavik": "ISK",
    "new zealand": "NZD", "auckland": "NZD",
    "sweden": "SEK", "stockholm": "SEK",
    "norway": "NOK", "oslo": "NOK",
    "denmark": "DKK", "copenhagen": "DKK",
    "czech republic": "CZK", "prague": "CZK",
    "poland": "PLN", "warsaw": "PLN", "krakow": "PLN",
    "hungary": "HUF", "budapest": "HUF",
    "croatia": "EUR", "zagreb": "EUR", "dubrovnik": "EUR",
    "costa rica": "CRC",
    "vietnam": "VND", "hanoi": "VND", "ho chi minh": "VND",
    "cambodia": "KHR", "siem reap": "KHR",
    "sri lanka": "LKR", "colombo": "LKR",
    "nepal": "NPR", "kathmandu": "NPR",
    "kenya": "KES", "nairobi": "KES",
    "tanzania": "TZS",
}


def guess_currencies(destinations: list[str], base: str) -> list[str]:
    """Guess which currencies the traveler will need."""
    currencies = set()
    for dest in destinations:
        dest_lower = dest.lower()
        for key, cur in DESTINATION_CURRENCIES.items():
            if key in dest_lower:
                if cur != base:
                    currencies.add(cur)
                break
    # Always include major ones if traveling internationally
    if not currencies:
        currencies = {"EUR", "GBP"}
    currencies.discard(base)
    return list(currencies)[:6]


async def get_rates(base: str, destinations: list[str]) -> CurrencyResult:
    """Fetch exchange rates for travel currencies."""
    try:
        target_currencies = guess_currencies(destinations, base)
        if not target_currencies:
            return CurrencyResult(base=base, error="No foreign currencies needed")

        symbols = ",".join(target_currencies)

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.frankfurter.dev/v1/latest",
                params={"base": base, "symbols": symbols},
            )
            resp.raise_for_status()
            data = resp.json()

        rates = {}
        for currency, rate in data.get("rates", {}).items():
            rates[currency] = CurrencyRate(
                from_currency=base,
                to_currency=currency,
                rate=round(rate, 4),
                inverse_rate=round(1 / rate, 4) if rate else 0,
                date=data.get("date", ""),
            )

        logger.info(f"Currency rates for {base}: {len(rates)} currencies fetched")
        return CurrencyResult(base=base, rates=rates)

    except Exception as e:
        logger.error(f"Currency error: {e}")
        return CurrencyResult(base=base, error=str(e))
