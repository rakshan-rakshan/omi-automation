"""
Heuristic song detection for Telugu Christian sermon videos.

Detection signals:
  1. Telugu/English worship vocabulary in the segment text
  2. Consecutive short segments (rhythmic pacing of sung content)
  3. Repeated lines across a context window (chorus repetition)
"""
from __future__ import annotations

import re
from typing import List

# Common Telugu Christian worship words (Telugu script + romanized)
_SONG_KEYWORDS = {
    # Telugu script
    "హల్లెలూయా",
    "హల్లెలూ",
    "ఆమెన్",
    "హోసన్న",
    "ఆరాధన",
    "స్తుతి",
    "స్తోత్రం",
    "కీర్తన",
    "గీతం",
    "పాడుదాం",
    "పాడు",
    "పాట",
    "జయహో",
    "జయ",
    "మహిమ",
    "కృప",
    "ప్రభువు",
    "యేసు",
    "దేవుడు",
    # Romanized / mixed
    "hallelujah",
    "hallellu",
    "hosanna",
    "amen",
    "worship",
    "praise",
    "glory",
    "yeshu",
    "yesu",
}

_SHORT_SEGMENT_MS = 2000
_BURST_COUNT = 3


def _keyword_score(text: str) -> float:
    """Score based on worship keywords in the text."""
    tokens = re.findall(r"\S+", text.lower())
    hits = sum(1 for t in tokens if t.strip(".,!?;:") in _SONG_KEYWORDS)
    if hits >= 3:
        return 0.90
    if hits == 2:
        return 0.70
    if hits == 1:
        return 0.50
    return 0.0


def _repetition_score(seg_text: str, neighbors: List[dict]) -> float:
    """Score based on chorus detection (repeated lines)."""
    text = seg_text.strip().lower()
    if len(text) < 8:
        return 0.0

    exact = sum(1 for n in neighbors if n["text"].strip().lower() == text)
    if exact >= 2:
        return 0.85
    if exact == 1:
        return 0.45

    prefix = text[:20]
    prefix_count = sum(1 for n in neighbors if n["text"].strip().lower().startswith(prefix))
    if prefix_count >= 3:
        return 0.75

    return 0.0


def _rhythm_score(seg: dict, neighbors: List[dict]) -> float:
    """Score based on rhythmic patterns (short segments in bursts)."""
    duration = seg["end_ms"] - seg["start_ms"]
    if duration >= _SHORT_SEGMENT_MS:
        return 0.0

    short_count = sum(
        1 for n in neighbors if (n["end_ms"] - n["start_ms"]) < _SHORT_SEGMENT_MS
    )
    if short_count >= _BURST_COUNT:
        return 0.40
    return 0.0


def detect_songs(segments: List[dict], window: int = 6) -> List[dict]:
    """
    Detect songs in a list of segments.

    Returns the same segments list with `is_song` (bool) and
    `song_confidence` (float 0-1) added to each segment dict.
    """
    n = len(segments)
    enriched = []

    for i, seg in enumerate(segments):
        lo = max(0, i - window)
        hi = min(n, i + window + 1)
        neighbors = segments[lo:i] + segments[i + 1 : hi]

        kw = _keyword_score(seg["text"])
        rep = _repetition_score(seg["text"], neighbors)
        rhy = _rhythm_score(seg, neighbors)

        confidence = min(1.0, max(kw, rep) + 0.25 * rhy)

        enriched.append(
            {
                **seg,
                "is_song": confidence >= 0.55,
                "song_confidence": round(confidence, 3),
            }
        )

    return enriched
