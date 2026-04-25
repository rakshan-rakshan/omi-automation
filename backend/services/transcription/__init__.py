"""Transcription service for YouTube videos.

Supports both YouTube captions (fast, free) and OpenAI Whisper (for non-captioned videos).
"""

from backend.services.transcription.youtube_fetcher import fetch_transcript
from backend.services.transcription.song_detector import detect_songs

__all__ = ["fetch_transcript", "detect_songs"]
