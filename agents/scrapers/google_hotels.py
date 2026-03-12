"""Scrape Google Hotels search results using Playwright."""
import logging
import urllib.parse
from models import HotelResult
from scrapers.base_scraper import new_page, safe_goto

logger = logging.getLogger(__name__)


def build_url(
    city: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    max_price: float = 0,
) -> str:
    """Build Google Hotels search URL."""
    params = {
        "q": f"hotels in {city}",
        "hl": "en",
        "gl": "us",
        "checkin": check_in,
        "checkout": check_out,
    }
    base = f"https://www.google.com/travel/hotels/{urllib.parse.quote(city)}"
    return f"{base}?{urllib.parse.urlencode(params)}"


async def scrape_google_hotels(
    city: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    max_price: float = 0,
    currency: str = "USD",
    max_results: int = 10,
    children: int = 0,
) -> list[HotelResult]:
    """Scrape hotel listings from Google Hotels."""
    results = []
    url = build_url(city, check_in, check_out, adults, max_price)

    try:
        async with new_page() as page:
            if not await safe_goto(page, url, timeout=20000):
                return results

            # Wait for hotel cards to appear (Google uses jsname="mutHjb" for cards)
            try:
                await page.wait_for_selector(
                    '[jsname="mutHjb"], [data-hotel-id], .uaTTDe',
                    timeout=10000,
                )
            except Exception:
                logger.warning("No hotel cards found on Google Hotels")
                return results

            # Extract hotel data from the page
            hotels = await page.evaluate(r"""() => {
                const results = [];
                // Google Travel uses jsname="mutHjb" or class .uaTTDe for hotel cards
                const cards = document.querySelectorAll(
                    '[jsname="mutHjb"], [data-hotel-id], .uaTTDe'
                );
                for (const card of cards) {
                    try {
                        // Hotel name is in h2
                        const nameEl = card.querySelector('h2');
                        const name = nameEl?.textContent?.trim() || '';
                        if (!name) continue;

                        // Find first span containing a dollar price
                        let price = null;
                        const allSpans = card.querySelectorAll('span');
                        for (const span of allSpans) {
                            const txt = span.textContent.trim();
                            // Match price like "$156" but not "$156 nightly" compound spans
                            const m = txt.match(/^\$[\d,]+$/);
                            if (m) {
                                price = parseInt(m[0].replace(/[$,]/g, ''));
                                break;
                            }
                        }

                        // Find rating like "4.3/5" or "4.6"
                        let rating = null;
                        let reviews = null;
                        for (const span of allSpans) {
                            const txt = span.textContent.trim();
                            const rm = txt.match(/^(\d\.\d)\/5$/);
                            if (rm) {
                                rating = parseFloat(rm[1]);
                                continue;
                            }
                            // Review count like "(529)" or "(1.8K)"
                            const revm = txt.match(/^\(([\d,.]+K?)\)$/);
                            if (revm && rating !== null) {
                                let rv = revm[1];
                                if (rv.endsWith('K')) {
                                    reviews = Math.round(parseFloat(rv) * 1000);
                                } else {
                                    reviews = parseInt(rv.replace(/,/g, ''));
                                }
                            }
                        }

                        if (name && price) {
                            results.push({ name, price, rating, reviews });
                        }
                    } catch(e) {}
                }
                return results.slice(0, 15);
            }""")

            def _clean(s):
                """Normalize Unicode whitespace for Windows compatibility."""
                if isinstance(s, str):
                    return s.replace("\u202f", " ").replace("\xa0", " ").strip()
                return s

            for h in hotels[:max_results]:
                if not h.get("name"):
                    continue
                price = h.get("price")
                if max_price and price and price > max_price:
                    continue
                results.append(
                    HotelResult(
                        name=_clean(h["name"]),
                        price_per_night=price,
                        currency=currency,
                        rating=h.get("rating"),
                        review_count=h.get("reviews"),
                        source="Google Hotels",
                        booking_url=f"https://www.google.com/travel/hotels/{urllib.parse.quote(city)}?q={urllib.parse.quote(h['name'] + ' ' + city)}",
                    )
                )

            logger.info(f"Google Hotels: {len(results)} hotels found for {city}")

    except Exception as e:
        logger.error(f"Google Hotels scraper error for {city}: {e}")

    return results
