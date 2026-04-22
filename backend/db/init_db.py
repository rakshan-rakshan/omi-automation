"""Auto-initialize the database schema on startup."""

from __future__ import annotations

import logging
from pathlib import Path

import asyncpg

from backend.config import settings

log = logging.getLogger(__name__)


async def init_db() -> None:
    schema_path = Path(__file__).parent / "schema.sql"
    sql = schema_path.read_text()

    raw_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

    try:
        conn = await asyncpg.connect(raw_url)
        try:
            await conn.execute(sql)
            log.info("Database schema initialized successfully")
        finally:
            await conn.close()
    except Exception as exc:
        log.warning("DB schema init warning (may already be up to date): %s", exc)
