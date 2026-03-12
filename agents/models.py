"""Pydantic models for verification request/response."""
from pydantic import BaseModel, Field
from typing import Optional


class VerifyRequest(BaseModel):
    """Incoming verification request from Node.js."""
    trip_plan: dict
    origin: str = ""
    destinations: list[str] = []
    check_in: str = ""
    check_out: str = ""
    adults: int = 2
    children: int = 0
    currency: str = "USD"
    budget_per_person: float = 0
    max_nightly: float = 0
    children_ages: list[int] = []
    passport_country: str = ""
    accommodation_types: list[str] = []


class WeatherDay(BaseModel):
    date: str
    temp_high: float
    temp_low: float
    precipitation_mm: float
    precipitation_chance: int  # percentage
    weather_code: int
    description: str
    icon: str  # emoji


class WeatherResult(BaseModel):
    location: str
    days: list[WeatherDay] = []
    error: Optional[str] = None


class CurrencyRate(BaseModel):
    from_currency: str
    to_currency: str
    rate: float
    inverse_rate: float
    date: str


class CurrencyResult(BaseModel):
    base: str
    rates: dict[str, CurrencyRate] = {}
    error: Optional[str] = None


class PlaceVerification(BaseModel):
    query: str
    found: bool = False
    name: str = ""
    lat: Optional[float] = None
    lon: Optional[float] = None
    address: str = ""
    place_type: str = ""
    maps_url: str = ""
    confidence: float = 0.0  # 0-1


class HotelResult(BaseModel):
    name: str
    price_per_night: Optional[float] = None
    currency: str = "USD"
    rating: Optional[float] = None
    review_count: Optional[int] = None
    source: str = ""
    booking_url: str = ""
    image_url: str = ""
    amenities: list[str] = []
    neighborhood: str = ""


class ActivityResult(BaseModel):
    name: str
    matched_activity: str = ""  # which Claude activity it matches
    price: Optional[float] = None
    currency: str = "USD"
    rating: Optional[float] = None
    review_count: Optional[int] = None
    source: str = ""
    booking_url: str = ""
    duration: str = ""
    image_url: str = ""


class FlightResult(BaseModel):
    airline: str
    price: Optional[float] = None
    currency: str = "USD"
    departure_time: str = ""
    arrival_time: str = ""
    duration: str = ""
    stops: int = 0
    stop_cities: list[str] = []
    source: str = ""
    booking_url: str = ""


class LinkCheck(BaseModel):
    url: str
    status: int = 0
    reachable: bool = False
    redirect_url: str = ""
    error: str = ""


class SafetyAlert(BaseModel):
    category: str  # "advisory" | "health" | "natural_disaster"
    severity: str  # "low" | "moderate" | "high" | "extreme"
    message: str = ""


class SafetyResult(BaseModel):
    destination: str
    country_code: str = ""
    country_name: str = ""
    score: float = 0.0  # 0-5 (0=safest)
    level: str = "unknown"  # low | moderate | high | extreme | do_not_travel
    emoji: str = "❓"
    advice: str = ""
    sources_active: int = 0
    updated: str = ""
    alerts: list[SafetyAlert] = []
    error: Optional[str] = None


class SeasonalInsight(BaseModel):
    category: str  # "temperature" | "rain" | "tourism" | "local"
    emoji: str
    title: str
    detail: str


class SeasonalResult(BaseModel):
    destination: str
    month: str = ""
    season: str = ""  # spring | summer | autumn | winter
    tourism_level: str = ""  # peak | shoulder | off-peak
    avg_temp_c: Optional[float] = None
    avg_precipitation_mm: Optional[float] = None
    avg_sunshine_hours: Optional[float] = None
    insights: list[SeasonalInsight] = []
    error: Optional[str] = None


class ReviewResult(BaseModel):
    place_name: str
    city: str = ""
    rating: Optional[float] = None  # 1-5
    review_count: Optional[int] = None
    category: str = ""
    snippets: list[str] = []
    maps_url: str = ""
    source: str = ""
    error: Optional[str] = None


class AgentStatus(BaseModel):
    agent: str
    status: str = "pending"  # pending | running | success | failed | skipped
    duration_ms: int = 0
    error: Optional[str] = None
    result_count: int = 0


class VerifyResponse(BaseModel):
    """Complete verification response."""
    weather: dict[str, WeatherResult] = {}  # keyed by destination
    safety: dict[str, SafetyResult] = {}  # keyed by destination
    seasonal: dict[str, SeasonalResult] = {}  # keyed by destination
    currency: Optional[CurrencyResult] = None
    places: list[PlaceVerification] = []
    hotels: dict[str, list[HotelResult]] = {}  # keyed by destination
    activities: list[ActivityResult] = []
    reviews: list[ReviewResult] = []
    flights: list[FlightResult] = []
    links: list[LinkCheck] = []
    agent_statuses: list[AgentStatus] = []
    verification_score: float = 0.0  # 0-100
    cached: bool = False
