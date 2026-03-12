"""Agent configuration — zero-config by default (all free scraping/APIs)."""
import os

AGENTS = {
    "hotels": {
        "enabled": True,
        "provider": "scraper",  # "scraper" | "serpapi" | "amadeus"
        "scrape_sources": ["google_hotels", "booking_com"],
        "max_results": 10,
        "cache_hours": 6,
    },
    "flights": {
        "enabled": True,
        "provider": "scraper",  # "scraper" | "amadeus" | "serpapi"
        "scrape_sources": ["google_flights"],
        "max_results": 5,
        "cache_hours": 1,
    },
    "activities": {
        "enabled": True,
        "provider": "scraper",  # "scraper" | "viator_api"
        "scrape_sources": ["viator", "getyourguide"],
        "max_results": 5,
        "cache_hours": 12,
    },
    "places": {
        "enabled": True,
        "provider": "nominatim",
        "cache_hours": 168,  # 1 week
    },
    "weather": {
        "enabled": True,
        "provider": "open_meteo",
        "cache_hours": 3,
    },
    "currency": {
        "enabled": True,
        "provider": "frankfurter",
        "cache_hours": 1,
    },
    "safety": {
        "enabled": True,
        "provider": "travel_advisory_info",
        "cache_hours": 24,
    },
    "seasonal": {
        "enabled": True,
        "provider": "open_meteo_climate",
        "cache_hours": 168,  # 1 week (climate data doesn't change)
    },
    "reviews": {
        "enabled": True,
        "provider": "scraper",
        "max_results": 10,
        "cache_hours": 48,
    },
    "links": {
        "enabled": True,
        "cache_hours": 24,
    },
}

# Optional API keys — add to .env to switch from scraping to APIs
SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")
AMADEUS_KEY = os.getenv("AMADEUS_KEY", "")
AMADEUS_SECRET = os.getenv("AMADEUS_SECRET", "")
VIATOR_API_KEY = os.getenv("VIATOR_API_KEY", "")
GOOGLE_PLACES_KEY = os.getenv("GOOGLE_PLACES_KEY", "")

# Auto-detect and upgrade providers when API keys are present
if SERPAPI_KEY:
    AGENTS["hotels"]["provider"] = "serpapi"
    AGENTS["flights"]["provider"] = "serpapi"
if AMADEUS_KEY and AMADEUS_SECRET:
    AGENTS["flights"]["provider"] = "amadeus"
if VIATOR_API_KEY:
    AGENTS["activities"]["provider"] = "viator_api"

# Scraping settings
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
]

SCRAPE_DELAY_MIN = 1.0  # seconds between requests
SCRAPE_DELAY_MAX = 3.0
VIEWPORT_WIDTH = 1920
VIEWPORT_HEIGHT = 1080
