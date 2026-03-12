"""Scrape Viator activity search results using httpx + BeautifulSoup."""
import httpx
import logging
import urllib.parse
from bs4 import BeautifulSoup
from models import ActivityResult
from scrapers.base_scraper import random_ua, random_delay

logger = logging.getLogger(__name__)


async def scrape_viator(
    query: str,
    city: str = "",
    max_results: int = 5,
    currency: str = "USD",
) -> list[ActivityResult]:
    """Scrape activity listings from Viator search."""
    results = []
    search_query = f"{query} {city}".strip()
    url = f"https://www.viator.com/searchResults/all?text={urllib.parse.quote(search_query)}"

    try:
        await random_delay()
        async with httpx.AsyncClient(
            timeout=15,
            headers={
                "User-Agent": random_ua(),
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            },
            follow_redirects=True,
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "lxml")

        # Try multiple selector patterns for Viator cards
        cards = soup.select('[data-testid="activity-card"], .product-card, .resultCard')

        if not cards:
            # Fallback: look for any card-like structure with title + price
            cards = soup.select('a[href*="/tours/"]')

        for card in cards[:max_results]:
            try:
                # Title
                title_el = card.select_one(
                    'h3, h2, [data-testid="activity-card-title"], .product-card__title'
                )
                title = title_el.get_text(strip=True) if title_el else ""

                # Price
                price_el = card.select_one(
                    '[data-testid="activity-card-price"], .product-card__price, [class*="price"]'
                )
                price_text = price_el.get_text(strip=True) if price_el else ""
                price = None
                if price_text:
                    import re
                    price_match = re.search(r'[\d,]+\.?\d*', price_text.replace(",", ""))
                    if price_match:
                        price = float(price_match.group())

                # Rating
                rating_el = card.select_one(
                    '[data-testid="activity-card-rating"], .product-card__rating, [class*="rating"]'
                )
                rating_text = rating_el.get_text(strip=True) if rating_el else ""
                rating = None
                if rating_text:
                    import re
                    rating_match = re.search(r'[\d.]+', rating_text)
                    if rating_match:
                        rating = float(rating_match.group())

                # Review count
                review_el = card.select_one('[class*="review-count"], [class*="reviews"]')
                review_text = review_el.get_text(strip=True) if review_el else ""
                review_count = None
                if review_text:
                    import re
                    review_match = re.search(r'[\d,]+', review_text.replace(",", ""))
                    if review_match:
                        review_count = int(review_match.group())

                # Duration
                duration_el = card.select_one('[class*="duration"]')
                duration = duration_el.get_text(strip=True) if duration_el else ""

                # Link
                link = ""
                link_el = card if card.name == "a" else card.select_one("a[href]")
                if link_el and link_el.get("href"):
                    href = link_el["href"]
                    if href.startswith("/"):
                        link = f"https://www.viator.com{href}"
                    elif href.startswith("http"):
                        link = href

                if title:
                    results.append(
                        ActivityResult(
                            name=title[:120],
                            matched_activity=query,
                            price=price,
                            currency=currency,
                            rating=rating,
                            review_count=review_count,
                            source="Viator",
                            booking_url=link or url,
                            duration=duration,
                        )
                    )
            except Exception as e:
                logger.debug(f"Viator: skipped card parse error: {e}")
                continue

        logger.info(f"Viator: {len(results)} activities found for '{search_query}'")

    except Exception as e:
        logger.error(f"Viator scraper error for '{query}': {e}")

    return results
