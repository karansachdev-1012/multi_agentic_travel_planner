"""Scrape Google search results for place ratings and review snippets using httpx."""
import httpx
import re
import logging
import urllib.parse
from bs4 import BeautifulSoup
from models import ReviewResult
from scrapers.base_scraper import random_ua, random_delay

logger = logging.getLogger(__name__)


async def scrape_google_reviews(
    place_name: str,
    city: str = "",
    max_reviews: int = 3,
) -> ReviewResult:
    """Scrape rating info from Google search for a place."""
    query = f"{place_name} {city} reviews".strip()
    url = f"https://www.google.com/search?q={urllib.parse.quote(query)}&hl=en"

    try:
        await random_delay()
        async with httpx.AsyncClient(
            timeout=12,
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

        # Try to find rating from Google's knowledge panel
        rating = None
        review_count = None
        category = ""

        # Method 1: Look for rating in structured data
        rating_el = soup.select_one('[data-attrid*="rating"], .Aq14fc, .yi40Hd')
        if rating_el:
            m = re.search(r'([\d.]+)\s*/\s*5|rated\s*([\d.]+)', rating_el.get_text(), re.I)
            if m:
                rating = float(m.group(1) or m.group(2))

        # Method 2: Look for stars pattern in any span
        if rating is None:
            for span in soup.select('span[aria-label*="star"], span[aria-label*="rating"], span[aria-label*="Rated"]'):
                text = span.get("aria-label", "")
                m = re.search(r'([\d.]+)', text)
                if m:
                    val = float(m.group(1))
                    if 1 <= val <= 5:
                        rating = val
                        break

        # Method 3: Look for rating text pattern anywhere
        if rating is None:
            text = soup.get_text()
            m = re.search(r'(\d\.\d)\s*(?:out of 5|stars?|rating)', text, re.I)
            if m:
                val = float(m.group(1))
                if 1 <= val <= 5:
                    rating = val

        # Review count
        for el in soup.select('span, div, a'):
            text = el.get_text(strip=True)
            m = re.search(r'([\d,]+)\s*(?:review|Google review)', text, re.I)
            if m:
                review_count = int(m.group(1).replace(",", ""))
                break

        # Category/type
        cat_el = soup.select_one('[data-attrid*="subtitle"], .YhemCb, .YPoYFe')
        if cat_el:
            category = cat_el.get_text(strip=True)[:80]

        # Extract review snippets
        snippets = []
        review_els = soup.select('.review-snippet, [data-attrid*="review"], .WMbnJf, .Jtu6Td, .OA0qNb')
        for r_el in review_els[:max_reviews]:
            snippet = r_el.get_text(strip=True)
            if len(snippet) > 15:
                snippets.append(snippet[:200])

        # Fallback snippets from meta descriptions
        if not snippets:
            for meta in soup.select('meta[name="description"], meta[property="og:description"]'):
                content = meta.get("content", "")
                if content and "review" in content.lower():
                    snippets.append(content[:200])

        maps_url = f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(f'{place_name} {city}')}"

        logger.info(f"Reviews for '{place_name}': rating={rating}, count={review_count}, snippets={len(snippets)}")
        return ReviewResult(
            place_name=place_name,
            city=city,
            rating=rating,
            review_count=review_count,
            category=category,
            snippets=snippets,
            maps_url=maps_url,
            source="Google",
        )

    except Exception as e:
        logger.error(f"Review scraper error for '{place_name}': {e}")
        return ReviewResult(
            place_name=place_name,
            city=city,
            error=str(e),
        )
