"""Reporting routes.

GET /reports/overview      Overall statistics
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Query
from sqlalchemy import text

from backend.api.deps import DB

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/overview")
async def overview(db: DB):
    """Overall platform statistics."""
    result = await db.execute(
        text(
            """
            SELECT
                COUNT(DISTINCT v.video_id) AS total_videos,
                COUNT(DISTINCT v.video_id) FILTER (WHERE v.fetch_status = 'complete')
                    AS ingested_videos,
                COUNT(s.segment_id) AS total_segments,
                COUNT(s.segment_id) FILTER (WHERE s.is_song = TRUE)
                    AS song_segments,
                COUNT(s.segment_id) FILTER (WHERE s.review_status = 'approved')
                    AS approved_segments
            FROM videos v
            LEFT JOIN segments s ON s.video_id = v.video_id
        """
        )
    )
    return dict(result.mappings().first())
