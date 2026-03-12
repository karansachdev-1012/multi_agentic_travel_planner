"""Scrape Google Flights search results using Playwright."""
import logging
import urllib.parse
from models import FlightResult
from scrapers.base_scraper import new_page, safe_goto

logger = logging.getLogger(__name__)


def build_url(origin: str, destination: str, date: str, passengers: int = 1) -> str:
    """Build Google Flights search URL."""
    query = f"flights from {origin} to {destination} on {date}"
    return f"https://www.google.com/travel/flights?q={urllib.parse.quote(query)}"


async def scrape_google_flights(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str = "",
    passengers: int = 1,
    currency: str = "USD",
    max_results: int = 5,
) -> list[FlightResult]:
    """Scrape flight listings from Google Flights."""
    results = []

    # Build round-trip search query
    query = f"flights from {origin} to {destination}"
    if departure_date:
        query += f" on {departure_date}"
    if return_date:
        query += f" return {return_date}"

    url = f"https://www.google.com/travel/flights?q={urllib.parse.quote(query)}"

    try:
        async with new_page() as page:
            if not await safe_goto(page, url, timeout=20000):
                return results

            # Wait for flight results
            try:
                await page.wait_for_selector(
                    '[class*="flight"], [data-resultid], .pIav2d, li[class*="Rk10dc"]',
                    timeout=10000,
                )
            except Exception:
                logger.warning("No flight cards found on Google Flights")
                return results

            flights = await page.evaluate("""() => {
                const results = [];
                // Try multiple selectors
                const cards = document.querySelectorAll(
                    'li[class*="Rk10dc"], [data-resultid], .pIav2d'
                );
                for (const card of cards) {
                    try {
                        // Airline
                        const airlineEl = card.querySelector(
                            '[class*="Ir0Voe"], [class*="airline"], .sSHqwe'
                        );
                        // Price
                        const priceEl = card.querySelector(
                            '[class*="price"], [class*="YMlIz"], .BVAVmf'
                        );
                        // Duration
                        const durationEl = card.querySelector(
                            '[class*="duration"], .Ak5kof, .gvkrdb'
                        );
                        // Stops
                        const stopsEl = card.querySelector(
                            '[class*="stops"], .EfT7Ae, .BbR8Ec'
                        );
                        // Times
                        const timeEls = card.querySelectorAll(
                            '[class*="time"], .mv1WYe span, .zxVSec'
                        );

                        const airline = airlineEl?.textContent?.trim() || '';
                        const priceText = priceEl?.textContent?.trim() || '';
                        const duration = durationEl?.textContent?.trim() || '';
                        const stopsText = stopsEl?.textContent?.trim() || '';

                        let depTime = '', arrTime = '';
                        if (timeEls.length >= 2) {
                            depTime = timeEls[0]?.textContent?.trim() || '';
                            arrTime = timeEls[1]?.textContent?.trim() || '';
                        }

                        if (airline || priceText) {
                            const priceMatch = priceText.match(/[\\d,]+/);
                            const price = priceMatch
                                ? parseInt(priceMatch[0].replace(/,/g, ''))
                                : null;

                            const stopsMatch = stopsText.match(/(\\d+)\\s*stop/i);
                            const stops = stopsText.toLowerCase().includes('nonstop')
                                ? 0
                                : stopsMatch
                                    ? parseInt(stopsMatch[1])
                                    : -1;

                            results.push({
                                airline, price, duration, stops,
                                depTime, arrTime, stopsText
                            });
                        }
                    } catch(e) {}
                }
                return results.slice(0, 10);
            }""")

            for f in flights[:max_results]:
                if not f.get("airline") and not f.get("price"):
                    continue
                results.append(
                    FlightResult(
                        airline=f.get("airline", "Unknown"),
                        price=f.get("price"),
                        currency=currency,
                        departure_time=f.get("depTime", ""),
                        arrival_time=f.get("arrTime", ""),
                        duration=f.get("duration", ""),
                        stops=f.get("stops", -1),
                        source="Google Flights",
                        booking_url=url,
                    )
                )

            logger.info(
                f"Google Flights: {len(results)} flights found for "
                f"{origin} -> {destination}"
            )

    except Exception as e:
        logger.error(f"Google Flights scraper error: {e}")

    return results
