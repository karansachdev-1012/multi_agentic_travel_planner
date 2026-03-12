"""Travel safety data using travel-advisory.info API (free, no key)."""
import httpx
import logging
from models import SafetyResult, SafetyAlert

logger = logging.getLogger(__name__)

# ISO 3166-1 alpha-2 country codes for common destinations
DESTINATION_COUNTRIES = {
    "japan": "JP", "tokyo": "JP", "osaka": "JP", "kyoto": "JP",
    "uk": "GB", "london": "GB", "england": "GB", "scotland": "GB",
    "france": "FR", "paris": "FR", "nice": "FR", "lyon": "FR",
    "germany": "DE", "berlin": "DE", "munich": "DE",
    "italy": "IT", "rome": "IT", "milan": "IT", "florence": "IT", "venice": "IT",
    "spain": "ES", "barcelona": "ES", "madrid": "ES", "seville": "ES",
    "greece": "GR", "athens": "GR", "santorini": "GR",
    "portugal": "PT", "lisbon": "PT", "porto": "PT",
    "netherlands": "NL", "amsterdam": "NL",
    "thailand": "TH", "bangkok": "TH", "phuket": "TH", "chiang mai": "TH",
    "india": "IN", "mumbai": "IN", "delhi": "IN", "goa": "IN", "jaipur": "IN",
    "australia": "AU", "sydney": "AU", "melbourne": "AU",
    "canada": "CA", "toronto": "CA", "vancouver": "CA",
    "mexico": "MX", "cancun": "MX", "mexico city": "MX",
    "brazil": "BR", "rio": "BR", "sao paulo": "BR",
    "south africa": "ZA", "cape town": "ZA", "johannesburg": "ZA",
    "singapore": "SG",
    "dubai": "AE", "uae": "AE", "abu dhabi": "AE",
    "switzerland": "CH", "zurich": "CH", "geneva": "CH",
    "turkey": "TR", "istanbul": "TR", "cappadocia": "TR",
    "indonesia": "ID", "bali": "ID", "jakarta": "ID",
    "malaysia": "MY", "kuala lumpur": "MY",
    "philippines": "PH", "manila": "PH", "cebu": "PH",
    "south korea": "KR", "seoul": "KR", "busan": "KR",
    "taiwan": "TW", "taipei": "TW",
    "hong kong": "HK",
    "colombia": "CO", "bogota": "CO", "medellin": "CO", "cartagena": "CO",
    "peru": "PE", "lima": "PE", "cusco": "PE",
    "chile": "CL", "santiago": "CL",
    "argentina": "AR", "buenos aires": "AR",
    "israel": "IL", "tel aviv": "IL", "jerusalem": "IL",
    "egypt": "EG", "cairo": "EG",
    "morocco": "MA", "marrakech": "MA", "fez": "MA",
    "iceland": "IS", "reykjavik": "IS",
    "new zealand": "NZ", "auckland": "NZ", "queenstown": "NZ",
    "sweden": "SE", "stockholm": "SE",
    "norway": "NO", "oslo": "NO",
    "denmark": "DK", "copenhagen": "DK",
    "czech republic": "CZ", "prague": "CZ",
    "poland": "PL", "warsaw": "PL", "krakow": "PL",
    "hungary": "HU", "budapest": "HU",
    "croatia": "HR", "zagreb": "HR", "dubrovnik": "HR", "split": "HR",
    "costa rica": "CR", "san jose": "CR",
    "vietnam": "VN", "hanoi": "VN", "ho chi minh": "VN",
    "cambodia": "KH", "siem reap": "KH", "phnom penh": "KH",
    "sri lanka": "LK", "colombo": "LK",
    "nepal": "NP", "kathmandu": "NP",
    "kenya": "KE", "nairobi": "KE",
    "tanzania": "TZ", "zanzibar": "TZ",
    "austria": "AT", "vienna": "AT", "salzburg": "AT",
    "belgium": "BE", "brussels": "BE",
    "ireland": "IE", "dublin": "IE",
    "finland": "FI", "helsinki": "FI",
    "romania": "RO", "bucharest": "RO",
    "bulgaria": "BG", "sofia": "BG",
    "china": "CN", "beijing": "CN", "shanghai": "CN",
    "russia": "RU", "moscow": "RU",
    "usa": "US", "united states": "US", "new york": "US", "los angeles": "US",
    "cuba": "CU", "havana": "CU",
    "dominican republic": "DO", "punta cana": "DO",
    "jamaica": "JM", "montego bay": "JM",
    "puerto rico": "US", "panama": "PA", "ecuador": "EC",
    "bolivia": "BO", "uruguay": "UY", "paraguay": "PY",
    "jordan": "JO", "amman": "JO", "petra": "JO",
    "oman": "OM", "muscat": "OM",
    "qatar": "QA", "doha": "QA",
    "bahrain": "BH",
    "ethiopia": "ET", "addis ababa": "ET",
    "rwanda": "RW", "kigali": "RW",
    "ghana": "GH", "accra": "GH",
    "senegal": "SN", "dakar": "SN",
    "madagascar": "MG",
    "mauritius": "MU",
    "fiji": "FJ",
    "maldives": "MV",
    "seychelles": "SC",
}


def guess_country_code(destination: str) -> str | None:
    """Map a destination name to ISO country code."""
    dest_lower = destination.lower().strip()
    for key, code in DESTINATION_COUNTRIES.items():
        if key in dest_lower or dest_lower in key:
            return code
    return None


def score_to_level(score: float) -> str:
    """Convert advisory score (0-5) to a human-readable level."""
    if score <= 1.5:
        return "low"
    elif score <= 2.5:
        return "moderate"
    elif score <= 3.5:
        return "high"
    elif score <= 4.5:
        return "extreme"
    else:
        return "do_not_travel"


def score_to_emoji(score: float) -> str:
    """Convert advisory score to emoji."""
    if score <= 1.5:
        return "🟢"
    elif score <= 2.5:
        return "🟡"
    elif score <= 3.5:
        return "🟠"
    else:
        return "🔴"


def score_to_advice(score: float, country_name: str) -> str:
    """Generate brief travel advice based on score."""
    if score <= 1.5:
        return f"{country_name} is generally very safe for travelers. Exercise normal precautions."
    elif score <= 2.5:
        return f"{country_name} requires increased caution. Be aware of your surroundings and check local conditions."
    elif score <= 3.5:
        return f"{country_name} has elevated safety concerns. Reconsider travel unless necessary and take extra precautions."
    elif score <= 4.5:
        return f"{country_name} has serious safety risks. Avoid non-essential travel and register with your embassy."
    else:
        return f"Travel to {country_name} is strongly discouraged. Extreme danger present."


async def get_safety(destination: str, passport_country: str = "") -> SafetyResult:
    """Fetch travel advisory data for a destination."""
    try:
        country_code = guess_country_code(destination)
        if not country_code:
            return SafetyResult(
                destination=destination,
                error=f"Could not determine country for '{destination}'",
            )

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://www.travel-advisory.info/api",
                params={"countrycode": country_code},
            )
            resp.raise_for_status()
            data = resp.json()

        api_status = data.get("api_status", {})
        if api_status.get("request", {}).get("item") != country_code:
            return SafetyResult(
                destination=destination,
                error="Unexpected API response",
            )

        country_data = data.get("data", {}).get(country_code, {})
        advisory = country_data.get("advisory", {})
        score = advisory.get("score", 0)
        country_name = country_data.get("name", destination)
        sources_active = advisory.get("sources_active", 0)
        updated = advisory.get("updated", "")

        level = score_to_level(score)
        emoji = score_to_emoji(score)
        advice = score_to_advice(score, country_name)
        if passport_country:
            advice += f" (Traveling with {passport_country.upper()} passport)"

        alerts = []
        if advisory.get("message"):
            alerts.append(SafetyAlert(
                category="advisory",
                severity=level,
                message=advisory["message"],
            ))

        logger.info(f"Safety for {destination} ({country_code}): score={score}, level={level}")
        return SafetyResult(
            destination=destination,
            country_code=country_code,
            country_name=country_name,
            score=round(score, 2),
            level=level,
            emoji=emoji,
            advice=advice,
            sources_active=sources_active,
            updated=updated,
            alerts=alerts,
        )

    except Exception as e:
        logger.error(f"Safety error for {destination}: {e}")
        return SafetyResult(destination=destination, error=str(e))
