"""
Transcript fetcher with fallback.

Priority:
  1. YouTube captions (youtube-transcript-api) — fast, free
  2. Audio download (yt-dlp) + OpenAI Whisper API — for non-captioned videos

Returns uniform dict regardless of source.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

_YT_ID_RE = re.compile(r"(?:v=|youtu\.be/|/v/|/embed/|shorts/)([A-Za-z0-9_-]{11})")


def extract_video_id(url: str) -> str:
    """Extract YouTube video ID from a URL."""
    m = _YT_ID_RE.search(url)
    if not m:
        raise ValueError(f"Cannot extract YouTube video ID from: {url}")
    return m.group(1)


async def _get_metadata(video_id: str) -> dict:
    """Fetch video metadata using yt-dlp (no download)."""
    import yt_dlp  # type: ignore

    loop = asyncio.get_event_loop()

    def _sync() -> dict:
        opts = {"quiet": True, "no_warnings": True, "skip_download": True}
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}", download=False
            )
        return {
            "title": info.get("title") or "",
            "channel": info.get("uploader") or "",
            "channel_id": info.get("channel_id") or "",
            "duration_ms": int((info.get("duration") or 0) * 1000),
            "thumbnail_url": info.get("thumbnail") or "",
            "tags": info.get("tags") or [],
        }

    return await loop.run_in_executor(None, _sync)


async def _fetch_captions(video_id: str) -> Optional[list]:
    """Return list of segment dicts, or None if no captions available."""
    from youtube_transcript_api import (  # type: ignore
        NoTranscriptFound,
        TranscriptsDisabled,
        YouTubeTranscriptApi,
    )

    loop = asyncio.get_event_loop()

    def _sync():
        try:
            tlist = YouTubeTranscriptApi.list_transcripts(video_id)
        except (NoTranscriptFound, TranscriptsDisabled):
            return None, None
        except Exception:
            return None, None

        # Prefer Telugu (manual > auto-generated), then English fallback
        for lang in ["te", "te-IN"]:
            try:
                return tlist.find_transcript([lang]).fetch(), "te"
            except Exception:
                pass
        try:
            return tlist.find_generated_transcript(["te", "te-IN"]).fetch(), "te"
        except Exception:
            pass
        try:
            return tlist.find_transcript(["en"]).fetch(), "en"
        except Exception:
            pass

        return None, None

    raw, lang = await loop.run_in_executor(None, _sync)
    if not raw:
        return None

    segments = []
    for i, item in enumerate(raw):
        start_ms = int(float(item["start"]) * 1000)
        dur_ms = int(float(item.get("duration") or 5) * 1000)
        segments.append(
            {
                "sequence_index": i,
                "start_ms": start_ms,
                "end_ms": start_ms + dur_ms,
                "text": item["text"].strip(),
                "language": lang,
            }
        )
    return segments


async def _whisper_transcribe(youtube_url: str, video_id: str) -> list:
    """Download audio (no video) and transcribe via OpenAI Whisper API."""
    from openai import AsyncOpenAI  # type: ignore
    import yt_dlp  # type: ignore

    from backend.config import settings

    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is required to transcribe non-captioned videos. "
            "Set it in Railway environment variables."
        )

    loop = asyncio.get_event_loop()

    with tempfile.TemporaryDirectory() as tmpdir:
        out_template = os.path.join(tmpdir, f"{video_id}.%(ext)s")

        def _download():
            opts = {
                "quiet": True,
                "no_warnings": True,
                "format": "bestaudio[ext=m4a]/bestaudio/best",
                "outtmpl": out_template,
            }
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([youtube_url])

        logger.info("Downloading audio-only for Whisper: %s", video_id)
        await loop.run_in_executor(None, _download)

        # yt-dlp fills in the actual extension
        audio_path: Optional[str] = None
        for fname in os.listdir(tmpdir):
            if fname.startswith(video_id):
                audio_path = os.path.join(tmpdir, fname)
                break

        if not audio_path or not os.path.exists(audio_path):
            raise RuntimeError(f"Audio download produced no file for {video_id}")

        size_mb = os.path.getsize(audio_path) / 1_000_000
        logger.info("Transcribing %.1f MB via Whisper: %s", size_mb, video_id)

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        with open(audio_path, "rb") as fh:
            response = await client.audio.transcriptions.create(
                file=fh,
                model="whisper-1",
                language="te",
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )

    segments = []
    for i, seg in enumerate(response.segments or []):
        segments.append(
            {
                "sequence_index": i,
                "start_ms": int(seg.start * 1000),
                "end_ms": int(seg.end * 1000),
                "text": seg.text.strip(),
                "language": "te",
            }
        )
    return segments


async def fetch_transcript(youtube_url: str) -> dict:
    """
    Fetch transcript for a YouTube video.

    Returns:
        {
            "source": "captions" | "whisper",
            "language": "te" | "en",
            "title": str,
            "channel": str,
            "channel_id": str,
            "duration_ms": int,
            "thumbnail_url": str,
            "tags": list[str],
            "segments": list[{sequence_index, start_ms, end_ms, text, language}],
        }
    """
    video_id = extract_video_id(youtube_url)

    # Fetch metadata and try captions concurrently
    meta_task = asyncio.create_task(_get_metadata(video_id))
    caption_task = asyncio.create_task(_fetch_captions(video_id))

    metadata, captions = await asyncio.gather(
        meta_task, caption_task, return_exceptions=True
    )

    if isinstance(metadata, Exception):
        logger.warning("Metadata fetch failed for %s: %s", video_id, metadata)
        metadata = {}

    if isinstance(captions, Exception):
        logger.info("Caption error for %s: %s", video_id, captions)
        captions = None

    if captions:
        lang = captions[0].get("language", "te") if captions else "te"
        logger.info("Using YouTube captions for %s (%d segs)", video_id, len(captions))
        return {
            **metadata,
            "source": "captions",
            "language": lang,
            "segments": captions,
        }

    logger.info("No captions for %s — using Whisper", video_id)
    segments = await _whisper_transcribe(youtube_url, video_id)
    return {
        **metadata,
        "source": "whisper",
        "language": "te",
        "segments": segments,
    }
