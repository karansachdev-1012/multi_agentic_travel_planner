"""SQLite async cache to avoid re-scraping."""
import aiosqlite
import json
import time
import os
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "cache.db")


async def init_db():
    """Create cache table if it doesn't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                created_at REAL NOT NULL,
                ttl_hours REAL NOT NULL
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_cache_created ON cache(created_at)
        """)
        await db.commit()
        # Purge expired entries on startup
        await db.execute(
            "DELETE FROM cache WHERE (created_at + ttl_hours * 3600) < ?",
            (time.time(),),
        )
        await db.commit()
        logger.info("Cache initialized, expired entries purged")


async def get_cached(key: str) -> dict | None:
    """Get a cached value if it exists and hasn't expired."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT value, created_at, ttl_hours FROM cache WHERE key = ?",
            (key,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        value, created_at, ttl_hours = row
        if time.time() > created_at + ttl_hours * 3600:
            await db.execute("DELETE FROM cache WHERE key = ?", (key,))
            await db.commit()
            return None
        return json.loads(value)


async def set_cached(key: str, value: dict, ttl_hours: float):
    """Store a value in cache with TTL."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT OR REPLACE INTO cache (key, value, created_at, ttl_hours)
               VALUES (?, ?, ?, ?)""",
            (key, json.dumps(value, default=str), time.time(), ttl_hours),
        )
        await db.commit()


async def clear_cache():
    """Clear all cached data."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM cache")
        await db.commit()


async def get_cache_stats() -> dict:
    """Get cache statistics."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM cache")
        total = (await cursor.fetchone())[0]
        cursor = await db.execute(
            "SELECT COUNT(*) FROM cache WHERE (created_at + ttl_hours * 3600) >= ?",
            (time.time(),),
        )
        valid = (await cursor.fetchone())[0]
        return {"total_entries": total, "valid_entries": valid, "expired": total - valid}
