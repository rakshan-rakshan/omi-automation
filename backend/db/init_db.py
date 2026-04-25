"""Auto-initialize the database schema on startup."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import asyncpg

from backend.config import settings

log = logging.getLogger(__name__)


async def init_db() -> None:
    schema_path = Path(__file__).parent / "schema.sql"
    sql = schema_path.read_text()

    raw_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

    max_retries = 3
    retry_count = 0

    while retry_count < max_retries:
        try:
            conn = await asyncpg.connect(raw_url, timeout=10)
            try:
                await conn.execute(sql)
                log.info("Database schema initialized successfully")
                return
            finally:
                await conn.close()
        except asyncpg.CannotConnectNowError as exc:
            retry_count += 1
            if retry_count < max_retries:
                log.warning(f"DB connection attempt {retry_count}/{max_retries} failed, retrying: {exc}")
                await asyncio.sleep(2 ** retry_count)  # exponential backoff
            else:
                log.warning("Database initialization failed after retries (may be starting up): %s", exc)
                return
        except Exception as exc:
            log.warning("DB schema init warning (may already be up to date): %s", exc)
            return
