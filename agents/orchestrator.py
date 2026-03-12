"""Orchestrator — runs all verification agents concurrently."""
import asyncio
import logging
import time
from models import (
    VerifyRequest, VerifyResponse, AgentStatus,
    WeatherResult, SafetyResult, SeasonalResult, CurrencyResult,
    PlaceVerification, HotelResult, ActivityResult, ReviewResult, FlightResult, LinkCheck,
)

logger = logging.getLogger(__name__)


def extract_places_from_plan(trip_plan: dict) -> list[dict[str, str]]:
    """Extract all place names + cities from the trip plan for verification."""
    places = []
    for day in trip_plan.get("days", []):
        city = day.get("location", "")
        for act in day.get("activities", []):
            if act.get("name"):
                places.append({"name": act["name"], "city": city})
        if day.get("diningTip", {}).get("name"):
            places.append({"name": day["diningTip"]["name"], "city": city})
    return places


def extract_activities_from_plan(trip_plan: dict) -> list[dict[str, str]]:
    """Extract activities with their booking keywords for verification."""
    activities = []
    seen = set()
    for day in trip_plan.get("days", []):
        city = day.get("location", "")
        for act in day.get("activities", []):
            keyword = act.get("bookingKeyword", "") or act.get("name", "")
            if keyword and keyword not in seen:
                activities.append({"name": keyword, "city": city})
                seen.add(keyword)
    return activities


def extract_urls_from_plan(trip_plan: dict) -> list[str]:
    """Extract all URLs from the trip plan for link verification."""
    urls = set()
    for day in trip_plan.get("days", []):
        for act in day.get("activities", []):
            if act.get("mapsQuery"):
                urls.add(f"https://www.google.com/maps/search/?api=1&query={act['mapsQuery']}")
    for acc in trip_plan.get("accommodations", []):
        for opt in acc.get("options", []):
            if opt.get("booking_url"):
                urls.add(opt["booking_url"])
    for fl in trip_plan.get("flights", []):
        if fl.get("booking_url"):
            urls.add(fl["booking_url"])
    return list(urls)[:50]  # Cap at 50 URLs


async def run_agent_task(name: str, coro) -> tuple[str, any, AgentStatus]:
    """Run a single agent and track its status."""
    status = AgentStatus(agent=name, status="running")
    start = time.time()
    try:
        result = await asyncio.wait_for(coro, timeout=45)
        elapsed = round((time.time() - start) * 1000)
        count = len(result) if isinstance(result, list) else (1 if result else 0)
        status = AgentStatus(
            agent=name, status="success",
            duration_ms=elapsed, result_count=count,
        )
        return name, result, status
    except asyncio.TimeoutError:
        elapsed = round((time.time() - start) * 1000)
        status = AgentStatus(
            agent=name, status="failed",
            duration_ms=elapsed, error="Timeout (45s)",
        )
        return name, None, status
    except Exception as e:
        elapsed = round((time.time() - start) * 1000)
        status = AgentStatus(
            agent=name, status="failed",
            duration_ms=elapsed, error=str(e)[:200],
        )
        logger.error(f"Agent {name} failed: {e}")
        return name, None, status


def _apply_result(response: VerifyResponse, name: str, result):
    """Apply a single agent result to the response object."""
    if result is None:
        return
    if name.startswith("weather:"):
        dest = name.split(":", 1)[1]
        if isinstance(result, WeatherResult):
            response.weather[dest] = result
    elif name.startswith("safety:"):
        dest = name.split(":", 1)[1]
        if isinstance(result, SafetyResult):
            response.safety[dest] = result
    elif name.startswith("seasonal:"):
        dest = name.split(":", 1)[1]
        if isinstance(result, SeasonalResult):
            response.seasonal[dest] = result
    elif name == "currency":
        if isinstance(result, CurrencyResult):
            response.currency = result
    elif name == "places":
        if isinstance(result, list):
            response.places = result
    elif name.startswith("hotels:"):
        dest = name.split(":", 1)[1]
        if isinstance(result, list):
            response.hotels[dest] = result
    elif name == "activities":
        if isinstance(result, list):
            response.activities = result
    elif name == "reviews":
        if isinstance(result, list):
            response.reviews = result
    elif name == "flights":
        if isinstance(result, list):
            response.flights = result
    elif name == "links":
        if isinstance(result, list):
            response.links = result


def _build_agent_coros(req: VerifyRequest):
    """Build the list of (name, coroutine) pairs for all agents."""
    from agents.weather_agent import run_weather_agent
    from agents.safety_agent import run_safety_agent
    from agents.seasonal_agent import run_seasonal_agent
    from agents.currency_agent import run_currency_agent
    from agents.place_agent import run_place_agent
    from agents.hotel_agent import run_hotel_agent
    from agents.activity_agent import run_activity_agent
    from agents.review_agent import run_review_agent
    from agents.flight_agent import run_flight_agent
    from agents.link_agent import run_link_agent

    plan = req.trip_plan
    destinations = req.destinations or plan.get("allDestinations", [])
    primary_dest = plan.get("primaryDestination", destinations[0] if destinations else "")

    agent_coros = []

    # Weather — one per destination
    for dest in destinations:
        agent_coros.append((
            f"weather:{dest}",
            run_weather_agent(dest, req.check_in, req.check_out),
        ))

    # Safety — one per destination
    for dest in destinations:
        agent_coros.append((
            f"safety:{dest}",
            run_safety_agent(dest, req.passport_country),
        ))

    # Seasonal — one per destination
    from free_apis.travel_advisories import guess_country_code
    for dest in destinations:
        cc = guess_country_code(dest) or ""
        agent_coros.append((
            f"seasonal:{dest}",
            run_seasonal_agent(dest, req.check_in, req.check_out, cc),
        ))

    # Currency
    agent_coros.append((
        "currency",
        run_currency_agent(req.currency, destinations),
    ))

    # Places — verify restaurants and attractions
    places = extract_places_from_plan(plan)
    async def verify_all_places():
        results = []
        for p in places[:20]:
            result = await run_place_agent(p["name"], p["city"])
            results.append(result)
        return results
    agent_coros.append(("places", verify_all_places()))

    # Hotels — one per accommodation location
    for acc in plan.get("accommodations", []):
        city = acc.get("location", primary_dest)
        ci = acc.get("checkIn", req.check_in)
        co = acc.get("checkOut", req.check_out)
        agent_coros.append((
            f"hotels:{city}",
            run_hotel_agent(city, ci, co, req.adults, len(req.children_ages), req.max_nightly, req.currency),
        ))

    # Activities
    activities = extract_activities_from_plan(plan)
    async def verify_all_activities():
        results = []
        for act in activities[:15]:
            act_results = await run_activity_agent(act["name"], act["city"], req.currency)
            results.extend(act_results)
        return results
    agent_coros.append(("activities", verify_all_activities()))

    # Reviews — ratings for key places (restaurants + attractions)
    review_places = extract_places_from_plan(plan)
    if review_places:
        agent_coros.append(("reviews", run_review_agent(review_places[:10])))

    # Flights
    agent_coros.append((
        "flights",
        run_flight_agent(
            req.origin, primary_dest,
            req.check_in, req.check_out,
            req.adults + len(req.children_ages), req.currency,
        ),
    ))

    # Links
    urls = extract_urls_from_plan(plan)
    if urls:
        agent_coros.append(("links", run_link_agent(urls)))

    return agent_coros


async def run_verification_streaming(req: VerifyRequest, on_result=None):
    """Run all agents concurrently, calling on_result(name, status, response) as each completes.
    Returns the final VerifyResponse."""
    agent_coros = _build_agent_coros(req)
    response = VerifyResponse()
    statuses = []

    async def run_and_report(name, coro):
        n, result, status = await run_agent_task(name, coro)
        statuses.append(status)
        _apply_result(response, n, result)
        if on_result:
            try:
                await on_result(n, status, response)
            except Exception as cb_err:
                logger.warning(f"on_result callback error for {n}: {cb_err}")
        return n, result, status

    await asyncio.gather(
        *(run_and_report(name, coro) for name, coro in agent_coros),
        return_exceptions=True,
    )

    response.agent_statuses = statuses
    total = len(statuses)
    successful = sum(1 for s in statuses if s.status == "success")
    response.verification_score = (successful / total * 100) if total > 0 else 0
    return response


async def run_verification(req: VerifyRequest) -> VerifyResponse:
    """Run all agents concurrently and build verification response (non-streaming)."""
    return await run_verification_streaming(req)
