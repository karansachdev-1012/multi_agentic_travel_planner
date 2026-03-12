"""Seasonal intelligence using Open-Meteo Climate API (free, no key).

Provides historical monthly averages for temperature, rain, and daylight
so travelers know what to expect for their travel dates.
"""
import httpx
import logging
from datetime import datetime
from models import SeasonalResult, SeasonalInsight
from free_apis.open_meteo import geocode

logger = logging.getLogger(__name__)

# Month names for display
MONTHS = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# Known peak/off-peak seasons by country/region (curated)
SEASONAL_TIPS = {
    "JP": {
        3: ["Cherry blossom season (sakura) begins late March", "Spring shoulder season — good prices, mild weather"],
        4: ["Peak cherry blossom viewing", "Golden Week (late April) is very crowded"],
        5: ["Golden Week continues early May — book well ahead", "Pleasant weather before rainy season"],
        6: ["Rainy season (tsuyu) in most regions", "Fewer tourists, lower prices"],
        7: ["Hot and humid", "Gion Festival in Kyoto", "Summer festivals begin"],
        8: ["Peak summer heat", "Obon holiday — domestic travel surge"],
        10: ["Autumn foliage season begins", "Excellent travel weather"],
        11: ["Peak autumn colors", "Shoulder season pricing"],
        12: ["Winter illuminations", "Onsen season", "Ski resorts open"],
    },
    "IT": {
        4: ["Spring shoulder season — pleasant weather, fewer crowds"],
        6: ["Peak season begins", "Long sunny days"],
        7: ["High season — book ahead, expect crowds", "Beach season"],
        8: ["Ferragosto (Aug 15) — many locals on holiday", "Very hot in south"],
        9: ["Shoulder season — great weather, fewer tourists"],
        10: ["Harvest season — wine and food festivals"],
    },
    "TH": {
        11: ["Cool season begins — best weather", "Peak tourist season starts"],
        12: ["Peak season — book ahead", "Cool and dry"],
        1: ["Peak season continues", "Loy Krathong in some areas"],
        2: ["Chinese New Year celebrations", "Still peak season"],
        3: ["Hot season begins", "Songkran approaches"],
        4: ["Songkran (Thai New Year) — water festival", "Very hot"],
        7: ["Monsoon season — heavy rains", "Low season prices"],
        8: ["Monsoon continues", "Budget-friendly"],
    },
    "FR": {
        6: ["Long days", "Music festival (Fête de la Musique Jun 21)"],
        7: ["Peak summer — Bastille Day Jul 14", "Tour de France"],
        8: ["Peak holiday — many Parisians leave Paris"],
        9: ["Shoulder season — excellent value", "Wine harvest"],
        12: ["Christmas markets", "Short days but festive"],
    },
    "GR": {
        6: ["Peak season begins", "Long sunny days, warm seas"],
        7: ["High season — expect crowds on islands", "Very hot"],
        8: ["Busiest month — book ahead", "Full moon festivals"],
        9: ["Shoulder season — warm seas, fewer crowds"],
        4: ["Easter celebrations — one of the best times to visit"],
    },
    "ES": {
        4: ["Semana Santa (Holy Week)", "Spring shoulder season"],
        6: ["Summer begins", "San Juan festival Jun 24"],
        7: ["Peak season — very hot inland", "Beach season"],
        8: ["Busiest month", "La Tomatina (last Wed of Aug)"],
        9: ["Shoulder season — warm, fewer tourists"],
    },
    "MX": {
        11: ["Dia de los Muertos (Nov 1-2)", "Dry season begins"],
        12: ["Peak tourist season", "Pleasant weather"],
        1: ["Peak season continues", "Whale watching season"],
        3: ["Spring break crowds in beach areas"],
        7: ["Rainy season", "Lower prices, fewer tourists"],
    },
}


def get_season(month: int, lat: float) -> str:
    """Determine the season based on month and hemisphere."""
    if lat >= 0:  # Northern hemisphere
        if month in (3, 4, 5):
            return "spring"
        elif month in (6, 7, 8):
            return "summer"
        elif month in (9, 10, 11):
            return "autumn"
        else:
            return "winter"
    else:  # Southern hemisphere
        if month in (3, 4, 5):
            return "autumn"
        elif month in (6, 7, 8):
            return "winter"
        elif month in (9, 10, 11):
            return "spring"
        else:
            return "summer"


def classify_tourism(month: int, country_code: str) -> str:
    """Classify tourism level: peak, shoulder, or off-peak."""
    peak_months = {
        "JP": [3, 4, 10, 11], "IT": [6, 7, 8, 9], "FR": [6, 7, 8],
        "TH": [11, 12, 1, 2], "GR": [6, 7, 8], "ES": [6, 7, 8],
        "MX": [11, 12, 1, 2, 3], "AU": [12, 1, 2], "GB": [6, 7, 8],
        "DE": [6, 7, 8, 12], "PT": [6, 7, 8, 9], "NL": [4, 5, 7, 8],
        "TR": [6, 7, 8, 9], "HR": [6, 7, 8], "IS": [6, 7, 8],
        "IN": [10, 11, 12, 1, 2], "ID": [6, 7, 8],
        "NZ": [12, 1, 2], "PE": [6, 7, 8],
    }
    shoulder = {
        "JP": [5, 6, 9, 12], "IT": [4, 5, 10], "FR": [4, 5, 9, 10],
        "TH": [3, 10], "GR": [4, 5, 9, 10], "ES": [4, 5, 9, 10],
    }
    if country_code in peak_months and month in peak_months[country_code]:
        return "peak"
    if country_code in shoulder and month in shoulder[country_code]:
        return "shoulder"
    return "off-peak"


def get_all_tourism_levels(country_code: str) -> dict[int, str]:
    """Get tourism level classification for all 12 months."""
    return {m: classify_tourism(m, country_code) for m in range(1, 13)}


async def get_seasonal(
    destination: str, check_in: str, check_out: str, country_code: str = ""
) -> SeasonalResult:
    """Fetch seasonal intelligence for a destination and travel period."""
    try:
        coords = await geocode(destination)
        if not coords:
            return SeasonalResult(
                destination=destination,
                error=f"Could not geocode '{destination}'",
            )

        lat, lon = coords

        # Parse travel months
        try:
            ci = datetime.strptime(check_in, "%Y-%m-%d")
            co = datetime.strptime(check_out, "%Y-%m-%d")
        except (ValueError, TypeError):
            return SeasonalResult(
                destination=destination,
                error="Invalid date format",
            )

        travel_month = ci.month
        season = get_season(travel_month, lat)
        tourism_level = classify_tourism(travel_month, country_code)

        # Fetch historical climate data from Open-Meteo
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://climate-api.open-meteo.com/v1/climate",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "models": "EC_Earth3P_HR",
                    "monthly": "temperature_2m_mean,precipitation_sum,shortwave_radiation_sum",
                    "start_date": "2020-01-01",
                    "end_date": "2020-12-31",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        monthly = data.get("monthly", {})
        times = monthly.get("time", [])
        temps = monthly.get("temperature_2m_mean", [])
        precip = monthly.get("precipitation_sum", [])
        radiation = monthly.get("shortwave_radiation_sum", [])

        # Extract data for travel month (0-indexed in API)
        month_idx = travel_month - 1
        avg_temp = round(temps[month_idx], 1) if month_idx < len(temps) else None
        avg_precip = round(precip[month_idx], 1) if month_idx < len(precip) else None
        avg_sun = round(radiation[month_idx] / 30, 1) if month_idx < len(radiation) and radiation[month_idx] else None

        # Build insights
        insights = []

        # Temperature insight
        if avg_temp is not None:
            if avg_temp >= 30:
                insights.append(SeasonalInsight(
                    category="temperature",
                    emoji="🌡️",
                    title="Very Hot",
                    detail=f"Average {avg_temp}°C in {MONTHS[travel_month]}. Pack light, stay hydrated.",
                ))
            elif avg_temp >= 20:
                insights.append(SeasonalInsight(
                    category="temperature",
                    emoji="☀️",
                    title="Warm & Pleasant",
                    detail=f"Average {avg_temp}°C in {MONTHS[travel_month]}. Great outdoor weather.",
                ))
            elif avg_temp >= 10:
                insights.append(SeasonalInsight(
                    category="temperature",
                    emoji="🧥",
                    title="Cool",
                    detail=f"Average {avg_temp}°C in {MONTHS[travel_month]}. Bring layers.",
                ))
            else:
                insights.append(SeasonalInsight(
                    category="temperature",
                    emoji="❄️",
                    title="Cold",
                    detail=f"Average {avg_temp}°C in {MONTHS[travel_month]}. Pack warm clothes.",
                ))

        # Precipitation insight
        if avg_precip is not None:
            if avg_precip >= 150:
                insights.append(SeasonalInsight(
                    category="rain",
                    emoji="🌧️",
                    title="Very Rainy",
                    detail=f"~{avg_precip}mm monthly rainfall. Pack rain gear and plan indoor alternatives.",
                ))
            elif avg_precip >= 80:
                insights.append(SeasonalInsight(
                    category="rain",
                    emoji="🌦️",
                    title="Moderate Rain",
                    detail=f"~{avg_precip}mm monthly rainfall. Bring an umbrella.",
                ))
            elif avg_precip <= 20:
                insights.append(SeasonalInsight(
                    category="rain",
                    emoji="☀️",
                    title="Dry Season",
                    detail=f"Only ~{avg_precip}mm monthly rainfall. Great conditions.",
                ))

        # Tourism level insight
        tourism_emoji = {"peak": "🔥", "shoulder": "👍", "off-peak": "💎"}
        tourism_title = {"peak": "Peak Season", "shoulder": "Shoulder Season", "off-peak": "Off-Peak Season"}
        tourism_detail = {
            "peak": "Expect higher prices and crowds. Book accommodation and tours in advance.",
            "shoulder": "Good balance of weather and crowds. Moderate prices, fewer reservations needed.",
            "off-peak": "Lower prices and fewer tourists. Some attractions may have reduced hours.",
        }
        insights.append(SeasonalInsight(
            category="tourism",
            emoji=tourism_emoji[tourism_level],
            title=tourism_title[tourism_level],
            detail=tourism_detail[tourism_level],
        ))

        # Country-specific seasonal tips
        if country_code and country_code in SEASONAL_TIPS:
            tips = SEASONAL_TIPS[country_code].get(travel_month, [])
            for tip in tips[:2]:
                insights.append(SeasonalInsight(
                    category="local",
                    emoji="📌",
                    title="Local Tip",
                    detail=tip,
                ))

        logger.info(f"Seasonal data for {destination}: {season}, {tourism_level}, {len(insights)} insights")
        return SeasonalResult(
            destination=destination,
            month=MONTHS[travel_month],
            season=season,
            tourism_level=tourism_level,
            avg_temp_c=avg_temp,
            avg_precipitation_mm=avg_precip,
            avg_sunshine_hours=avg_sun,
            insights=insights,
        )

    except Exception as e:
        logger.error(f"Seasonal error for {destination}: {e}")
        return SeasonalResult(destination=destination, error=str(e))
