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

            # Wait for hotel cards to appear
            try:
                await page.wait_for_selector(
                    '[data-hotel-id], .pR0Vc, .FGlSad, [jsname="mutHjb"]',
                    timeout=8000,
                )
            except Exception:
                logger.warning("No hotel cards found on Google Hotels")
                return results

            # Extract hotel data from the page
            hotels = await page.evaluate("""() => {
                const results = [];
                // Try multiple selectors for hotel cards
                const cards = document.querySelectorAll(
                    '[data-hotel-id], .pR0Vc, .FGlSad'
                );
                for (const card of cards) {
                    try {
                        const nameEl = card.querySelector(
                            'h2, .QT7m7, .BgYkof, [class*="title"]'
                        );
                        const priceEl = card.querySelector(
                            '.kixHKb, .MW1oTb, [class*="price"]'
                        );
                        const ratingEl = card.querySelector(
                            '.KFi5wf, .jdzyld, [class*="rating"]'
                        );
                        const reviewEl = card.querySelector(
                            '.jdzyld + span, [class*="review"]'
                        );

                        const name = nameEl?.textContent?.trim() || '';
                        let priceText = priceEl?.textContent?.trim() || '';
                        const ratingText = ratingEl?.textContent?.trim() || '';
                        const reviewText = reviewEl?.textContent?.trim() || '';

                        if (name) {
                            // Extract numeric price
                            const priceMatch = priceText.match(/[\\d,]+/);
                            const price = priceMatch
                                ? parseInt(priceMatch[0].replace(/,/g, ''))
                                : null;

                            const ratingMatch = ratingText.match(/[\\d.]+/);
                            const rating = ratingMatch
                                ? parseFloat(ratingMatch[0])
                                : null;

                            const reviewMatch = reviewText.match(/[\\d,]+/);
                            const reviews = reviewMatch
                                ? parseInt(reviewMatch[0].replace(/,/g, ''))
                                : null;

                            results.push({
                                name, price, rating, reviews, priceText
                            });
                        }
                    } catch(e) {}
                }
                return results.slice(0, 15);
            }""")

            for h in hotels[:max_results]:
                if not h.get("name"):
                    continue
                price = h.get("price")
                if max_price and price and price > max_price:
                    continue
                results.append(
                    HotelResult(
                        name=h["name"],
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
