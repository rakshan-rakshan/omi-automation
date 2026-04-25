"""Dataset export routes for fine-tuning.

GET /dataset/export        JSONL/CSV of approved translations
GET /dataset/stats         Dataset statistics
"""
from __future__ import annotations

import io
import json
import logging
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text

from backend.api.deps import DB

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dataset", tags=["dataset"])

_SYSTEM_MSG = (
    "You are a professional Telugu-to-English translator specialising in Christian ministry. "
    "Produce accurate, natural English that preserves theological meaning."
)


@router.get("/export")
async def export_dataset(
    db: DB,
    format: str = Query("jsonl", pattern="^(jsonl|csv)$"),
):
    """Export approved Telugu-English pairs for fine-tuning."""
    result = await db.execute(
        text(
            """
            SELECT
                s.segment_id::text, s.telugu_raw,
                COALESCE(s.english_refined, s.english_best_model,
                        s.english_good_model, s.english_cheap_model)
                AS english_text
            FROM segments s
            WHERE s.review_status = 'approved' AND s.telugu_raw IS NOT NULL
              AND s.is_song = FALSE
            ORDER BY s.created_at
        """
        )
    )
    rows = result.mappings().all()

    if format == "jsonl":
        lines = []
        for r in rows:
            if not r["english_text"]:
                continue
            lines.append(
                json.dumps(
                    {
                        "messages": [
                            {"role": "system", "content": _SYSTEM_MSG},
                            {"role": "user", "content": f"Translate: {r['telugu_raw']}"},
                            {"role": "assistant", "content": r["english_text"]},
                        ]
                    },
                    ensure_ascii=False,
                )
            )
        content = "\n".join(lines)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/jsonl",
            headers={"Content-Disposition": 'attachment; filename="omited-dataset.jsonl"'},
        )
    else:  # csv
        lines = ["segment_id,telugu,english"]
        for r in rows:
            if not r["english_text"]:
                continue
            lines.append(
                f'{r["segment_id"]},"{r["telugu_raw"].replace('"', '""')}","{r["english_text"].replace('"', '""')}"'
            )
        content = "\n".join(lines)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="omited-dataset.csv"'},
        )


@router.get("/stats")
async def dataset_stats(db: DB):
    """Dataset statistics."""
    result = await db.execute(
        text(
            """
            SELECT
                COUNT(DISTINCT v.video_id) AS videos,
                COUNT(s.segment_id) AS total_segments,
                COUNT(s.segment_id) FILTER (WHERE s.review_status = 'approved')
                    AS approved_segments,
                COUNT(s.segment_id) FILTER (WHERE s.is_song = TRUE)
                    AS song_segments
            FROM videos v
            LEFT JOIN segments s ON s.video_id = v.video_id
        """
        )
    )
    return dict(result.mappings().first())
