"""
Translation API routes.

Endpoints
---------
POST /translate/segment/{segment_id}       Translate one segment
POST /translate/video/{video_id}           Translate all segments in a video (background)
GET  /translate/video/{video_id}/status    Progress for a video translation job
POST /translate/segment/{segment_id}/approve  Mark a translation as approved
POST /translate/segment/{segment_id}/edit     Submit a human correction

Model selection
---------------
Requests accept an optional `model_id` (any OpenRouter model string, e.g.
"google/gemma-2-27b-it") that overrides the tier-based default. Callers may
also supply an `X-Api-Key` header to use their own OpenRouter key.
"""

from __future__ import annotations

import logging
from typing import List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import text

from backend.api.deps import DB
from backend.services.translation import TranslationRouter, LLMResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/translate", tags=["translate"])

_translation_router = TranslationRouter()

_TIER_COLUMN = {
    "best": "english_best_model",
    "good": "english_good_model",
    "cheap": "english_cheap_model",
}

_TIER_VERSION = {
    "best": "best_model",
    "good": "good_model",
    "cheap": "cheap_model",
}


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class TranslateSegmentRequest(BaseModel):
    tier: Literal["best", "good", "cheap"] = "good"
    model_id: Optional[str] = None  # overrides tier when provided
    set_active: bool = True


class TranslateVideoRequest(BaseModel):
    tier: Literal["best", "good", "cheap"] = "good"
    model_id: Optional[str] = None  # overrides tier when provided
    concurrency: int = 5
    skip_songs: bool = True
    set_active: bool = True

    @field_validator("concurrency")
    @classmethod
    def clamp(cls, v: int) -> int:
        return max(1, min(v, 10))


class ApproveRequest(BaseModel):
    reviewer_id: Optional[str] = None


class EditRequest(BaseModel):
    english_text: str
    reviewer_id: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("english_text")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("english_text must not be empty")
        return v.strip()


class TranslationResponse(BaseModel):
    segment_id: str
    tier: str
    model_id: Optional[str] = None
    translated_text: str
    model: str
    tokens_input: int
    tokens_output: int
    cost_usd: float
    latency_ms: int
    is_active: bool


class VideoTranslationStatus(BaseModel):
    video_id: str
    total_segments: int
    translated_count: int
    song_count: int
    pending_review: int
    approved_count: int


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

async def _fetch_glossary(db: DB) -> List[dict]:
    result = await db.execute(
        text("SELECT telugu_term, english_standard FROM glossary_terms ORDER BY usage_count DESC LIMIT 200")
    )
    return [dict(r) for r in result.mappings()]


async def _fetch_idioms(db: DB) -> List[dict]:
    result = await db.execute(
        text("SELECT telugu_phrase, english_contextual FROM idioms ORDER BY usage_count DESC LIMIT 50")
    )
    return [dict(r) for r in result.mappings()]


async def _write_translation(
    db: DB,
    segment_id: str,
    tier: str,
    result,
    model_id: Optional[str] = None,
    set_active: bool = True,
) -> None:
    if set_active:
        await db.execute(
            text("""
                UPDATE translations SET is_active = FALSE
                WHERE segment_id = :sid::uuid
                  AND tier = :tier::model_tier_enum
                  AND is_active = TRUE
            """),
            {"sid": segment_id, "tier": tier},
        )

    await db.execute(
        text("""
            INSERT INTO translations (
                segment_id, model_id, tier, translated_text,
                tokens_input, tokens_output, cost_usd, latency_ms,
                prompt_version, is_active
            ) VALUES (
                :sid::uuid,
                :model_id::uuid,
                :tier::model_tier_enum,
                :text,
                :ti, :to, :cost, :lat,
                :pv, :active
            )
        """),
        {
            "sid": segment_id,
            "model_id": model_id,
            "tier": tier,
            "text": result.translated_text,
            "ti": result.tokens_input,
            "to": result.tokens_output,
            "cost": result.cost_usd,
            "lat": result.latency_ms,
            "pv": result.prompt_version,
            "active": set_active,
        },
    )

    col = _TIER_COLUMN.get(tier, "english_good_model")
    version = _TIER_VERSION.get(tier, "good_model")
    set_active_clause = (
        f", active_translation_version = '{version}'::translation_version_enum"
        if set_active
        else ""
    )
    await db.execute(
        text(f"""
            UPDATE segments
            SET {col} = :text {set_active_clause}, updated_at = NOW()
            WHERE segment_id = :sid::uuid
        """),
        {"text": result.translated_text, "sid": segment_id},
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/segment/{segment_id}",
    response_model=TranslationResponse,
    status_code=status.HTTP_200_OK,
    summary="Translate a single segment",
)
async def translate_segment(
    segment_id: str,
    body: TranslateSegmentRequest,
    db: DB,
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
):
    seg_result = await db.execute(
        text("SELECT segment_id::text, telugu_raw, is_song FROM segments WHERE segment_id = :sid::uuid"),
        {"sid": segment_id},
    )
    seg = seg_result.mappings().first()
    if not seg:
        raise HTTPException(status_code=404, detail=f"Segment {segment_id} not found")
    if not seg["telugu_raw"]:
        raise HTTPException(status_code=422, detail="Segment has no Telugu text to translate")

    glossary = await _fetch_glossary(db)
    idioms = await _fetch_idioms(db)

    result = await _translation_router.translate_segment(
        segment_id=segment_id,
        telugu_text=seg["telugu_raw"],
        tier=body.tier,
        glossary_terms=glossary,
        idioms=idioms,
        model=body.model_id,
        api_key=x_api_key,
    )

    if not result.translated_text:
        raise HTTPException(status_code=502, detail="Translation model returned empty response")

    await _write_translation(db, segment_id, body.tier, result, set_active=body.set_active)
    await db.commit()

    return TranslationResponse(
        segment_id=segment_id,
        tier=body.tier,
        model_id=body.model_id,
        translated_text=result.translated_text,
        model=result.model,
        tokens_input=result.tokens_input,
        tokens_output=result.tokens_output,
        cost_usd=result.cost_usd,
        latency_ms=result.latency_ms,
        is_active=body.set_active,
    )


@router.post(
    "/video/{video_id}",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Translate all segments in a video (background)",
)
async def translate_video(
    video_id: str,
    body: TranslateVideoRequest,
    background_tasks: BackgroundTasks,
    db: DB,
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
):
    check = await db.execute(
        text("SELECT segment_count FROM videos WHERE video_id = :vid::uuid"),
        {"vid": video_id},
    )
    if not check.first():
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

    from backend.db.database import AsyncSessionLocal

    captured_api_key = x_api_key

    async def _run():
        async with AsyncSessionLocal() as session:
            try:
                song_filter = "AND is_song = FALSE" if body.skip_songs else ""
                seg_result = await session.execute(
                    text(f"""
                        SELECT segment_id::text, telugu_raw
                        FROM segments
                        WHERE video_id = :vid::uuid
                          AND telugu_raw IS NOT NULL
                          AND telugu_raw != ''
                          {song_filter}
                        ORDER BY sequence_index
                    """),
                    {"vid": video_id},
                )
                segments = [
                    {"segment_id": r["segment_id"], "telugu_text": r["telugu_raw"]}
                    for r in seg_result.mappings()
                ]

                if not segments:
                    logger.info("No translatable segments for video %s", video_id)
                    return

                glossary = await _fetch_glossary(session)
                idioms = await _fetch_idioms(session)

                results = await _translation_router.translate_batch(
                    segments=segments,
                    tier=body.tier,
                    glossary_terms=glossary,
                    idioms=idioms,
                    concurrency=body.concurrency,
                    model=body.model_id,
                    api_key=captured_api_key,
                )

                for res in results:
                    if res.translated_text:
                        await _write_translation(
                            session, res.segment_id, body.tier, res,
                            set_active=body.set_active,
                        )

                await session.commit()
                logger.info(
                    "Translated video %s — %d/%d segments via %s",
                    video_id,
                    sum(1 for r in results if r.translated_text),
                    len(results),
                    body.model_id or body.tier,
                )
            except Exception as exc:
                await session.rollback()
                logger.error("Video translation failed for %s: %s", video_id, exc, exc_info=True)

    background_tasks.add_task(_run)

    return {
        "video_id": video_id,
        "tier": body.tier,
        "model_id": body.model_id,
        "message": "Translation started in background.",
    }


@router.get(
    "/video/{video_id}/status",
    response_model=VideoTranslationStatus,
    summary="Translation progress for a video",
)
async def video_translation_status(video_id: str, db: DB):
    check = await db.execute(
        text("SELECT 1 FROM videos WHERE video_id = :vid::uuid"),
        {"vid": video_id},
    )
    if not check.first():
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

    result = await db.execute(
        text("""
            SELECT
                COUNT(*)                                               AS total_segments,
                COUNT(*) FILTER (WHERE english_good_model IS NOT NULL
                              OR english_best_model IS NOT NULL
                              OR english_cheap_model IS NOT NULL)      AS translated_count,
                COUNT(*) FILTER (WHERE is_song = TRUE)                 AS song_count,
                COUNT(*) FILTER (WHERE review_status = 'pending')      AS pending_review,
                COUNT(*) FILTER (WHERE review_status = 'approved')     AS approved_count
            FROM segments WHERE video_id = :vid::uuid
        """),
        {"vid": video_id},
    )
    row = result.mappings().first()

    return VideoTranslationStatus(video_id=video_id, **dict(row))


@router.post(
    "/segment/{segment_id}/approve",
    status_code=status.HTTP_200_OK,
    summary="Mark a segment translation as approved",
)
async def approve_segment(segment_id: str, body: ApproveRequest, db: DB):
    check = await db.execute(
        text("SELECT 1 FROM segments WHERE segment_id = :sid::uuid"),
        {"sid": segment_id},
    )
    if not check.first():
        raise HTTPException(status_code=404, detail=f"Segment {segment_id} not found")

    await db.execute(
        text("""
            UPDATE segments
            SET review_status = 'approved'::review_status_enum,
                reviewer_id   = :reviewer_id::uuid,
                reviewed_at   = NOW(),
                updated_at    = NOW()
            WHERE segment_id = :sid::uuid
        """),
        {"sid": segment_id, "reviewer_id": body.reviewer_id},
    )

    await db.execute(
        text("""
            INSERT INTO reviews (segment_id, reviewer_id, action)
            VALUES (:sid::uuid, :rid::uuid, 'approve')
        """),
        {"sid": segment_id, "rid": body.reviewer_id},
    )

    await db.commit()
    return {"segment_id": segment_id, "status": "approved"}


@router.post(
    "/segment/{segment_id}/edit",
    status_code=status.HTTP_200_OK,
    summary="Submit a human-edited translation for a segment",
)
async def edit_segment(segment_id: str, body: EditRequest, db: DB):
    prev_result = await db.execute(
        text("""
            SELECT COALESCE(english_refined, english_good_model, english_google, '') AS prev_text
            FROM segments WHERE segment_id = :sid::uuid
        """),
        {"sid": segment_id},
    )
    prev_row = prev_result.first()
    if not prev_row:
        raise HTTPException(status_code=404, detail=f"Segment {segment_id} not found")

    await db.execute(
        text("""
            UPDATE segments
            SET english_refined               = :text,
                active_translation_version    = 'refined'::translation_version_enum,
                review_status                 = 'approved'::review_status_enum,
                reviewer_id                   = :rid::uuid,
                reviewed_at                   = NOW(),
                updated_at                    = NOW()
            WHERE segment_id = :sid::uuid
        """),
        {"text": body.english_text, "rid": body.reviewer_id, "sid": segment_id},
    )

    await db.execute(
        text("""
            INSERT INTO reviews (segment_id, reviewer_id, action, previous_text, new_text, notes)
            VALUES (:sid::uuid, :rid::uuid, 'edit', :prev, :new, :notes)
        """),
        {
            "sid": segment_id,
            "rid": body.reviewer_id,
            "prev": prev_row[0],
            "new": body.english_text,
            "notes": body.notes,
        },
    )

    await db.commit()
    return {"segment_id": segment_id, "status": "edited", "english_text": body.english_text}
