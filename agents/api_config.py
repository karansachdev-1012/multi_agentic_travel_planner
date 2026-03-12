"""Centralized API configuration loader.

Reads optional API keys from environment variables.
If a key is present, the corresponding agent will use the official API;
otherwise it silently falls back to the existing scraper.
"""
import os


def get_amadeus_config() -> dict:
    """Amadeus Flight Offers Search — requires both KEY and SECRET (OAuth2)."""
    return {
        "key": os.getenv("AMADEUS_API_KEY", ""),
        "secret": os.getenv("AMADEUS_API_SECRET", ""),
        "base_url": os.getenv("AMADEUS_API_BASE_URL", "") or "https://api.amadeus.com",
    }


def get_booking_config() -> dict:
    """Booking.com Partner API — requires KEY, affiliate ID optional."""
    return {
        "key": os.getenv("BOOKING_API_KEY", ""),
        "affiliate_id": os.getenv("BOOKING_AFFILIATE_ID", ""),
    }


def get_viator_config() -> dict:
    """Viator Partner API — requires KEY only."""
    return {
        "key": os.getenv("VIATOR_API_KEY", ""),
    }


def get_google_places_config() -> dict:
    """Google Places API (New) — requires KEY only."""
    return {
        "key": os.getenv("GOOGLE_PLACES_API_KEY", ""),
    }
