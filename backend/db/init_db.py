"""Auto-initialize the database schema on startup."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import asyncpg

from backend.config import settings

log = logging.getLogger(__name__)


async def init_db() -> None:
    """Initialize database schema with robust error handling and timeouts."""
    schema_path = Path(__file__).parent / "schema.sql"
    sql = schema_path.read_text()
    raw_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

    try:
        # Set a strict 5-second timeout for the entire operation
        conn = await asyncio.wait_for(
            asyncpg.connect(raw_url, timeout=5),
            timeout=6
        )
        try:
            await asyncio.wait_for(conn.execute(sql), timeout=10)
            log.info("Database schema initialized successfully")
        finally:
            await conn.close()
    except asyncio.TimeoutError:
        log.warning("Database initialization timed out (DB may be starting or unreachable)")
    except asyncpg.CannotConnectNowError as exc:
        log.warning("Database not ready yet (will retry on next request): %s", exc)
    except Exception as exc:
        log.warning("Database initialization warning (may already be up to date): %s", exc)
