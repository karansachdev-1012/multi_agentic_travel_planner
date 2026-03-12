"""Weather agent using Open-Meteo API (free, no key, 10k calls/day)."""
import httpx
import logging
from models import WeatherDay, WeatherResult

logger = logging.getLogger(__name__)

# WMO weather code to description + emoji mapping
WMO_CODES = {
    0: ("Clear sky", "☀️"),
    1: ("Mainly clear", "🌤️"),
    2: ("Partly cloudy", "⛅"),
    3: ("Overcast", "☁️"),
    45: ("Foggy", "🌫️"),
    48: ("Rime fog", "🌫️"),
    51: ("Light drizzle", "🌦️"),
    53: ("Moderate drizzle", "🌦️"),
    55: ("Dense drizzle", "🌧️"),
    56: ("Freezing drizzle", "🌨️"),
    57: ("Dense freezing drizzle", "🌨️"),
    61: ("Slight rain", "🌦️"),
    63: ("Moderate rain", "🌧️"),
    65: ("Heavy rain", "🌧️"),
    66: ("Freezing rain", "🌨️"),
    67: ("Heavy freezing rain", "🌨️"),
    71: ("Slight snow", "🌨️"),
    73: ("Moderate snow", "❄️"),
    75: ("Heavy snow", "❄️"),
    77: ("Snow grains", "❄️"),
    80: ("Slight showers", "🌦️"),
    81: ("Moderate showers", "🌧️"),
    82: ("Violent showers", "⛈️"),
    85: ("Slight snow showers", "🌨️"),
    86: ("Heavy snow showers", "❄️"),
    95: ("Thunderstorm", "⛈️"),
    96: ("Thunderstorm w/ hail", "⛈️"),
    99: ("Thunderstorm w/ heavy hail", "⛈️"),
}


async def geocode(city: str) -> tuple[float, float] | None:
    """Get lat/lon for a city using Open-Meteo geocoding."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": city, "count": 1, "language": "en"},
        )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if not results:
            return None
        return results[0]["latitude"], results[0]["longitude"]


async def get_weather(
    location: str, check_in: str, check_out: str
) -> WeatherResult:
    """Fetch weather forecast for a location and date range."""
    try:
        coords = await geocode(location)
        if not coords:
            return WeatherResult(
                location=location, error=f"Could not geocode '{location}'"
            )

        lat, lon = coords

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code",
                    "start_date": check_in,
                    "end_date": check_out,
                    "timezone": "auto",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        daily = data.get("daily", {})
        dates = daily.get("time", [])
        days = []

        for i, date in enumerate(dates):
            code = daily["weather_code"][i] if i < len(daily.get("weather_code", [])) else 0
            desc, icon = WMO_CODES.get(code, ("Unknown", "❓"))
            days.append(
                WeatherDay(
                    date=date,
                    temp_high=daily["temperature_2m_max"][i] if i < len(daily.get("temperature_2m_max", [])) else 0,
                    temp_low=daily["temperature_2m_min"][i] if i < len(daily.get("temperature_2m_min", [])) else 0,
                    precipitation_mm=daily["precipitation_sum"][i] if i < len(daily.get("precipitation_sum", [])) else 0,
                    precipitation_chance=daily["precipitation_probability_max"][i] if i < len(daily.get("precipitation_probability_max", [])) else 0,
                    weather_code=code,
                    description=desc,
                    icon=icon,
                )
            )

        logger.info(f"Weather for {location}: {len(days)} days fetched")
        return WeatherResult(location=location, days=days)

    except Exception as e:
        logger.error(f"Weather error for {location}: {e}")
        return WeatherResult(location=location, error=str(e))
