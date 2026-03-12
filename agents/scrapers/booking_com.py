"""Scrape Booking.com search results using Playwright with stealth."""
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
    children: int = 0,
) -> str:
    """Build Booking.com search URL."""
    params = {
        "ss": city,
        "checkin": check_in,
        "checkout": check_out,
        "group_adults": adults,
        "group_children": children,
        "no_rooms": 1,
        "selected_currency": "USD",
    }
    return f"https://www.booking.com/searchresults.html?{urllib.parse.urlencode(params)}"


async def scrape_booking(
    city: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    max_price: float = 0,
    currency: str = "USD",
    max_results: int = 10,
    children: int = 0,
) -> list[HotelResult]:
    """Scrape hotel listings from Booking.com."""
    results = []
    url = build_url(city, check_in, check_out, adults, children)

    try:
        async with new_page() as page:
            if not await safe_goto(page, url, timeout=25000):
                return results

            # Wait for property cards
            try:
                await page.wait_for_selector(
                    '[data-testid="property-card"], .sr_property_block',
                    timeout=10000,
                )
            except Exception:
                logger.warning("No property cards found on Booking.com")
                return results

            hotels = await page.evaluate("""() => {
                const results = [];
                const cards = document.querySelectorAll(
                    '[data-testid="property-card"], .sr_property_block'
                );
                for (const card of cards) {
                    try {
                        const nameEl = card.querySelector(
                            '[data-testid="title"], .sr-hotel__name'
                        );
                        const priceEl = card.querySelector(
                            '[data-testid="price-and-discounted-price"], .bui-price-display__value, [class*="price"]'
                        );
                        const ratingEl = card.querySelector(
                            '[data-testid="review-score"] > div:first-child, .bui-review-score__badge'
                        );
                        const reviewCountEl = card.querySelector(
                            '[data-testid="review-score"] > div:nth-child(2) > div:nth-child(2), .bui-review-score__text'
                        );
                        const linkEl = card.querySelector('a[href*="/hotel/"]');

                        const name = nameEl?.textContent?.trim() || '';
                        const priceText = priceEl?.textContent?.trim() || '';
                        const ratingText = ratingEl?.textContent?.trim() || '';
                        const reviewText = reviewCountEl?.textContent?.trim() || '';
                        const href = linkEl?.href || '';

                        if (name) {
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
                                name, price, rating, reviews, href
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
                        source="Booking.com",
                        booking_url=h.get("href", build_url(city, check_in, check_out, adults, children)),
                    )
                )

            logger.info(f"Booking.com: {len(results)} hotels found for {city}")

    except Exception as e:
        logger.error(f"Booking.com scraper error for {city}: {e}")

    return results
