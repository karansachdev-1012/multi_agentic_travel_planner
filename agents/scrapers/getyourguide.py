"""Scrape GetYourGuide activity search results using httpx + BeautifulSoup."""
import httpx
import logging
import urllib.parse
import re
from bs4 import BeautifulSoup
from models import ActivityResult
from scrapers.base_scraper import random_ua, random_delay

logger = logging.getLogger(__name__)


async def scrape_getyourguide(
    query: str,
    city: str = "",
    max_results: int = 5,
    currency: str = "USD",
) -> list[ActivityResult]:
    """Scrape activity listings from GetYourGuide search."""
    results = []
    search_query = f"{query} {city}".strip()
    url = f"https://www.getyourguide.com/s/?q={urllib.parse.quote(search_query)}"

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

        # GetYourGuide uses activity cards
        cards = soup.select(
            '[data-activity-card], .activity-card, [class*="ActivityCard"]'
        )

        if not cards:
            cards = soup.select('a[href*="/activity/"]')

        for card in cards[:max_results]:
            try:
                title_el = card.select_one(
                    'h3, h2, [class*="title"], [class*="Title"]'
                )
                title = title_el.get_text(strip=True) if title_el else ""

                price_el = card.select_one(
                    '[class*="price"], [class*="Price"]'
                )
                price_text = price_el.get_text(strip=True) if price_el else ""
                price = None
                if price_text:
                    price_match = re.search(r'[\d,]+\.?\d*', price_text.replace(",", ""))
                    if price_match:
                        price = float(price_match.group())

                rating_el = card.select_one('[class*="rating"], [class*="Rating"]')
                rating_text = rating_el.get_text(strip=True) if rating_el else ""
                rating = None
                if rating_text:
                    rating_match = re.search(r'[\d.]+', rating_text)
                    if rating_match:
                        rating = float(rating_match.group())

                review_el = card.select_one('[class*="review"], [class*="Review"]')
                review_text = review_el.get_text(strip=True) if review_el else ""
                review_count = None
                if review_text:
                    review_match = re.search(r'[\d,]+', review_text.replace(",", ""))
                    if review_match:
                        review_count = int(review_match.group())

                duration_el = card.select_one('[class*="duration"], [class*="Duration"]')
                duration = duration_el.get_text(strip=True) if duration_el else ""

                link = ""
                link_el = card if card.name == "a" else card.select_one("a[href]")
                if link_el and link_el.get("href"):
                    href = link_el["href"]
                    if href.startswith("/"):
                        link = f"https://www.getyourguide.com{href}"
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
                            source="GetYourGuide",
                            booking_url=link or url,
                            duration=duration,
                        )
                    )
            except Exception:
                continue

        logger.info(
            f"GetYourGuide: {len(results)} activities found for '{search_query}'"
        )

    except Exception as e:
        logger.error(f"GetYourGuide scraper error for '{query}': {e}")

    return results
