"""Scrape Google Flights search results using Playwright."""
import logging
import urllib.parse
from models import FlightResult
from scrapers.base_scraper import new_page, safe_goto

logger = logging.getLogger(__name__)


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

            flights = await page.evaluate(r"""() => {
                const results = [];
                const cards = document.querySelectorAll(
                    'li.pIav2d, li[class*="Rk10dc"], [data-resultid]'
                );
                for (const card of cards) {
                    try {
                        // Extract price from spans containing "$" sign
                        let price = null;
                        for (const span of card.querySelectorAll('span')) {
                            const t = span.textContent.replace(/[\u202f\xa0]/g, ' ').trim();
                            const m = t.match(/^\$[\d,]+$/);
                            if (m) {
                                price = parseInt(m[0].replace(/[$,]/g, ''));
                                break;
                            }
                        }

                        // Get full card text for parsing
                        const text = card.innerText.replace(/[\u202f\xa0]/g, ' ');
                        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

                        // Airline is typically after the times (3rd-4th line)
                        let airline = '';
                        let duration = '';
                        let stops = -1;
                        let depTime = '';
                        let arrTime = '';

                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i];
                            // Departure/arrival times like "12:30 AM"
                            if (/^\d{1,2}:\d{2}\s*(AM|PM)/.test(line) && !depTime) {
                                depTime = line;
                            } else if (/^\d{1,2}:\d{2}\s*(AM|PM)/.test(line) && depTime && !arrTime) {
                                arrTime = line;
                            }
                            // Duration like "8 hr" or "8 hr 45 min"
                            if (/^\d+\s*hr/.test(line)) {
                                duration = line;
                            }
                            // Airline name (not a number, time, or airport code)
                            if (airline === '' && i >= 2 && line.length > 3
                                && !/^\d/.test(line) && !/^[A-Z]{3}/.test(line)
                                && !line.includes('stop') && !line.includes('hr')
                                && !line.includes('CO2') && !line.includes('$')
                                && !line.includes('emissions') && !line.includes('round trip')
                                && !/^(AM|PM)$/.test(line)) {
                                airline = line;
                            }
                            // Stops
                            if (/nonstop/i.test(line)) stops = 0;
                            const sm = line.match(/^(\d+)\s*stop/i);
                            if (sm) stops = parseInt(sm[1]);
                        }

                        if (price) {
                            results.push({
                                airline, price, duration, stops,
                                depTime, arrTime
                            });
                        }
                    } catch(e) {}
                }
                return results.slice(0, 10);
            }""")

            def _clean(s):
                """Normalize Unicode whitespace chars that break Windows console."""
                if isinstance(s, str):
                    return s.replace("\u202f", " ").replace("\xa0", " ").strip()
                return s

            for f in flights[:max_results]:
                if not f.get("airline") and not f.get("price"):
                    continue
                results.append(
                    FlightResult(
                        airline=_clean(f.get("airline", "Unknown")),
                        price=f.get("price"),
                        currency=currency,
                        departure_time=_clean(f.get("depTime", "")),
                        arrival_time=_clean(f.get("arrTime", "")),
                        duration=_clean(f.get("duration", "")),
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
