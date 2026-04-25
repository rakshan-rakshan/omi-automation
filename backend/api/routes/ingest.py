"""Ingest API routes for YouTube transcript fetching.

POST   /ingest/video              Add a single YouTube video
POST   /ingest/batch              Batch add multiple URLs
GET    /ingest/videos             List all videos
GET    /ingest/video/{id}         Video detail
GET    /ingest/video/{id}/segments  Segments for video
PATCH  /ingest/segment/{id}/song  Toggle song flag
DELETE /ingest/video/{id}         Delete video + segments
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy import text

from backend.api.deps import DB

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["ingest"])


class IngestVideoRequest(BaseModel):
    youtube_url: str

    @field_validator("youtube_url")
    @classmethod
    def must_be_youtube(cls, v: str) -> str:
        if "youtube.com" not in v and "youtu.be" not in v:
            raise ValueError("Must be a YouTube URL")
        return v.strip()


class BatchIngestRequest(BaseModel):
    youtube_urls: List[str]
    max_concurrency: int = 3

    @field_validator("youtube_urls")
    @classmethod
    def validate_urls(cls, v: List[str]) -> List[str]:
        if not v or len(v) > 200:
            raise ValueError("Must have 1-200 URLs")
        return [u.strip() for u in v if "youtube.com" in u or "youtu.be" in u]


class SongToggleRequest(BaseModel):
    is_song: bool
    confidence: float = 1.0


async def _do_ingest(video_id: str, youtube_url: str) -> None:
    """Background task: fetch transcript, detect songs, insert segments."""
    from backend.db.database import AsyncSessionLocal
    from backend.services.transcription import fetch_transcript, detect_songs

    async with AsyncSessionLocal() as db:
        try:
            await db.execute(
                text(
                    "UPDATE videos SET fetch_status = 'fetching' WHERE video_id = :vid::uuid"
                ),
                {"vid": video_id},
            )
            await db.commit()

            result = await fetch_transcript(youtube_url)
            await db.execute(
                text(
                    """
                    UPDATE videos SET
                        title = :title, channel = :channel, channel_id = :ch_id,
                        duration_ms = :dur, thumbnail_url = :thumb,
                        tags = :tags, transcript_source = :src::transcript_source_enum,
                        fetch_date = NOW()
                    WHERE video_id = :vid::uuid
                """
                ),
                {
                    "title": result.get("title"),
                    "channel": result.get("channel"),
                    "ch_id": result.get("channel_id"),
                    "dur": result.get("duration_ms"),
                    "thumb": result.get("thumbnail_url"),
                    "tags": result.get("tags") or [],
                    "src": "auto",
                    "vid": video_id,
                },
            )
            await db.commit()

            segments = detect_songs(result.get("segments") or [])
            for seg in segments:
                await db.execute(
                    text(
                        """
                        INSERT INTO segments (
                            video_id, sequence_index, start_ms, end_ms,
                            telugu_raw, is_song, song_confidence
                        ) VALUES (:vid::uuid, :idx, :s, :e, :text, :is_song, :conf)
                        ON CONFLICT (video_id, sequence_index) DO UPDATE SET
                            telugu_raw = EXCLUDED.telugu_raw,
                            is_song = EXCLUDED.is_song,
                            song_confidence = EXCLUDED.song_confidence,
                            updated_at = NOW()
                    """
                    ),
                    {
                        "vid": video_id,
                        "idx": seg["sequence_index"],
                        "s": seg["start_ms"],
                        "e": seg["end_ms"],
                        "text": seg.get("text"),
                        "is_song": seg["is_song"],
                        "conf": seg["song_confidence"],
                    },
                )

            await db.execute(
                text(
                    """
                    UPDATE videos SET
                        fetch_status = 'complete'::fetch_status_enum,
                        segment_count = :cnt, updated_at = NOW()
                    WHERE video_id = :vid::uuid
                """
                ),
                {"cnt": len(segments), "vid": video_id},
            )
            await db.commit()
            logger.info("Ingest complete: %s (%d segs)", video_id, len(segments))
        except Exception as exc:
            await db.rollback()
            logger.error("Ingest failed for %s: %s", video_id, exc, exc_info=True)
            try:
                await db.execute(
                    text(
                        """
                        UPDATE videos SET
                            fetch_status = 'failed'::fetch_status_enum,
                            metadata = jsonb_set(metadata, '{error}', :err::jsonb),
                            updated_at = NOW()
                        WHERE video_id = :vid::uuid
                    """
                    ),
                    {"vid": video_id, "err": f'"{str(exc)[:200]}"'},
                )
                await db.commit()
            except Exception:
                pass


@router.post("/video", status_code=status.HTTP_202_ACCEPTED)
async def ingest_video(
    body: IngestVideoRequest,
    background_tasks: BackgroundTasks,
    db: DB,
):
    """Add a single YouTube video for ingestion."""
    from backend.services.transcription.youtube_fetcher import extract_video_id

    yt_id = extract_video_id(body.youtube_url)
    existing = await db.execute(
        text("SELECT video_id::text FROM videos WHERE youtube_video_id = :yt_id"),
        {"yt_id": yt_id},
    )
    row = existing.mappings().first()
    if row:
        return {"video_id": row[0], "status": "already_exists"}

    result = await db.execute(
        text(
            """
            INSERT INTO videos (youtube_url, youtube_video_id, fetch_status)
            VALUES (:url, :yt_id, 'pending'::fetch_status_enum)
            RETURNING video_id::text
        """
        ),
        {"url": body.youtube_url, "yt_id": yt_id},
    )
    vid = result.scalar_one()
    await db.commit()

    background_tasks.add_task(_do_ingest, vid, body.youtube_url)
    return {"video_id": vid, "status": "pending", "message": "Ingestion started"}


@router.get("/videos")
async def list_videos(db: DB, limit: int = Query(50, le=200), offset: int = Query(0, ge=0)):
    """List all videos."""
    result = await db.execute(
        text(
            """
            SELECT v.video_id::text, v.youtube_url, v.title, v.fetch_status,
                   v.segment_count, v.transcript_source
            FROM videos v
            ORDER BY v.created_at DESC
            LIMIT :limit OFFSET :offset
        """
        ),
        {"limit": limit, "offset": offset},
    )
    return {"videos": [dict(r) for r in result.mappings()]}


@router.get("/video/{video_id}")
async def get_video(video_id: str, db: DB):
    """Get video detail."""
    result = await db.execute(
        text("SELECT * FROM videos WHERE video_id = :vid::uuid"),
        {"vid": video_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404)
    return dict(row)


@router.get("/video/{video_id}/segments")
async def get_segments(
    video_id: str,
    db: DB,
    is_song: Optional[bool] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
):
    """Get segments for a video."""
    check = await db.execute(
        text("SELECT 1 FROM videos WHERE video_id = :vid::uuid"),
        {"vid": video_id},
    )
    if not check.first():
        raise HTTPException(status_code=404)

    where = "WHERE video_id = :vid::uuid"
    params = {"vid": video_id, "limit": limit, "offset": offset}
    if is_song is not None:
        where += " AND is_song = :is_song"
        params["is_song"] = is_song

    result = await db.execute(
        text(
            f"""
            SELECT segment_id::text, sequence_index, start_ms, end_ms,
                   telugu_raw, english_good_model, is_song, song_confidence,
                   review_status
            FROM segments {where}
            ORDER BY sequence_index
            LIMIT :limit OFFSET :offset
        """
        ),
        params,
    )
    return {"segments": [dict(r) for r in result.mappings()]}


@router.patch("/segment/{segment_id}/song")
async def toggle_song(segment_id: str, body: SongToggleRequest, db: DB):
    """Toggle song flag on a segment."""
    check = await db.execute(
        text("SELECT 1 FROM segments WHERE segment_id = :sid::uuid"),
        {"sid": segment_id},
    )
    if not check.first():
        raise HTTPException(status_code=404)

    await db.execute(
        text(
            """
            UPDATE segments
            SET is_song = :is_song, song_confidence = :conf, updated_at = NOW()
            WHERE segment_id = :sid::uuid
        """
        ),
        {"sid": segment_id, "is_song": body.is_song, "conf": body.confidence},
    )
    await db.commit()
    return {"segment_id": segment_id, "is_song": body.is_song}


@router.delete("/video/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(video_id: str, db: DB):
    """Delete video and all segments."""
    check = await db.execute(
        text("SELECT 1 FROM videos WHERE video_id = :vid::uuid"),
        {"vid": video_id},
    )
    if not check.first():
        raise HTTPException(status_code=404)
    await db.execute(
        text("DELETE FROM videos WHERE video_id = :vid::uuid"),
        {"vid": video_id},
    )
    await db.commit()
