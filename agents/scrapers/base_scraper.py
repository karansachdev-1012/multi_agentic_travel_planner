"""Base scraper with retry logic, anti-detection, and user-agent rotation."""
import asyncio
import random
import logging
from contextlib import asynccontextmanager
from playwright.async_api import async_playwright, Browser, Page

from config import USER_AGENTS, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, SCRAPE_DELAY_MIN, SCRAPE_DELAY_MAX

logger = logging.getLogger(__name__)

# Shared browser instance
_browser: Browser | None = None
_browser_lock = asyncio.Lock()


def random_ua() -> str:
    return random.choice(USER_AGENTS)


async def random_delay():
    await asyncio.sleep(random.uniform(SCRAPE_DELAY_MIN, SCRAPE_DELAY_MAX))


async def get_browser() -> Browser:
    """Get or create shared browser instance."""
    global _browser
    async with _browser_lock:
        if _browser is None or not _browser.is_connected():
            pw = await async_playwright().start()
            _browser = await pw.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                ],
            )
            logger.info("Playwright browser launched")
        return _browser


@asynccontextmanager
async def new_page():
    """Create a new browser page with anti-detection setup."""
    browser = await get_browser()
    context = await browser.new_context(
        viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
        user_agent=random_ua(),
        locale="en-US",
        timezone_id="America/New_York",
    )
    page = await context.new_page()

    # Anti-detection: override navigator.webdriver
    await page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {} };
    """)

    try:
        yield page
    finally:
        await context.close()


async def safe_goto(page: Page, url: str, timeout: int = 30000) -> bool:
    """Navigate to URL with error handling."""
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
        await random_delay()
        return True
    except Exception as e:
        logger.warning(f"Navigation failed for {url}: {e}")
        return False
