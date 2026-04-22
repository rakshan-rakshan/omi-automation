"""
Multi-tier translation router.

Tiers
-----
  best  — highest quality (claude-opus-4-7)  — used for final/review passes
  good  — balanced (claude-sonnet-4-6)       — default batch translation
  cheap — fast/cheap (claude-haiku-4-5)      — bulk first-pass drafts

Callers may also pass a raw `model` string to bypass the tier system entirely,
e.g. "google/gemma-2-27b-it" or any OpenRouter model ID.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

from backend.config import settings
from backend.services.translation.openrouter_client import LLMResponse, OpenRouterClient

logger = logging.getLogger(__name__)

_PROMPT_VERSION = "v1.0"

_SYSTEM_TEMPLATE = """You are a professional Telugu-to-English translator specialising in Christian ministry content.

Your task is to produce accurate, natural English translations of Telugu transcript segments.

Rules:
1. Output ONLY the English translation — no explanations, no markup, no commentary.
2. Preserve speaker intent, tone, and theological meaning.
3. Use plain modern English suitable for subtitles.
4. Do not translate proper nouns (people names, place names) unless a standard English form exists.
5. Keep segments short and readable — match the pacing of the original.
{glossary_section}
{idiom_section}"""

_USER_TEMPLATE = "Translate this Telugu segment to English:\n\n{telugu_text}"


@dataclass
class TranslationResult:
    segment_id: str
    tier: str
    translated_text: str
    model: str
    tokens_input: int
    tokens_output: int
    cost_usd: float
    latency_ms: int
    prompt_version: str


class TranslationRouter:
    """
    Routes translation requests to the appropriate model tier,
    or to an explicit model ID when provided.
    """

    def __init__(self, client: Optional[OpenRouterClient] = None):
        self._client = client or OpenRouterClient()
        self._tier_models = {
            "best": settings.model_best,
            "good": settings.model_good,
            "cheap": settings.model_cheap,
        }

    def _build_system_prompt(
        self,
        glossary_terms: Optional[List[dict]] = None,
        idioms: Optional[List[dict]] = None,
    ) -> str:
        glossary_section = ""
        if glossary_terms:
            lines = "\n".join(
                f"  - {t['telugu_term']} → {t['english_standard']}"
                for t in glossary_terms[:50]
            )
            glossary_section = f"\nGlossary (use these exact English terms):\n{lines}"

        idiom_section = ""
        if idioms:
            lines = "\n".join(
                f"  - \"{i['telugu_phrase']}\" means \"{i['english_contextual']}\""
                for i in idioms[:20]
            )
            idiom_section = f"\nIdioms (translate these phrases contextually):\n{lines}"

        return _SYSTEM_TEMPLATE.format(
            glossary_section=glossary_section,
            idiom_section=idiom_section,
        )

    async def translate_segment(
        self,
        segment_id: str,
        telugu_text: str,
        tier: str = "good",
        glossary_terms: Optional[List[dict]] = None,
        idioms: Optional[List[dict]] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> TranslationResult:
        """Translate a single segment. Never raises — returns empty text on error."""
        resolved_model = model or self._tier_models.get(tier, self._tier_models["good"])
        system_prompt = self._build_system_prompt(glossary_terms, idioms)
        user_message = _USER_TEMPLATE.format(telugu_text=telugu_text.strip())

        try:
            response: LLMResponse = await self._client.complete(
                model=resolved_model,
                system_prompt=system_prompt,
                user_message=user_message,
                temperature=0.2,
                max_tokens=512,
                prompt_version=_PROMPT_VERSION,
                api_key=api_key,
            )
            return TranslationResult(
                segment_id=segment_id,
                tier=tier,
                translated_text=response.text,
                model=response.model,
                tokens_input=response.tokens_input,
                tokens_output=response.tokens_output,
                cost_usd=response.cost_usd,
                latency_ms=response.latency_ms,
                prompt_version=_PROMPT_VERSION,
            )
        except Exception as exc:
            logger.error("Translation failed for segment %s (model=%s): %s", segment_id, resolved_model, exc)
            return TranslationResult(
                segment_id=segment_id,
                tier=tier,
                translated_text="",
                model=resolved_model,
                tokens_input=0,
                tokens_output=0,
                cost_usd=0.0,
                latency_ms=0,
                prompt_version=_PROMPT_VERSION,
            )

    async def translate_batch(
        self,
        segments: List[dict],
        tier: str = "good",
        glossary_terms: Optional[List[dict]] = None,
        idioms: Optional[List[dict]] = None,
        concurrency: int = 5,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> List[TranslationResult]:
        """
        Translate multiple segments concurrently.
        Each dict must have keys: segment_id, telugu_text.
        """
        import asyncio

        sem = asyncio.Semaphore(concurrency)

        async def _one(seg: dict) -> TranslationResult:
            async with sem:
                return await self.translate_segment(
                    segment_id=seg["segment_id"],
                    telugu_text=seg["telugu_text"],
                    tier=tier,
                    glossary_terms=glossary_terms,
                    idioms=idioms,
                    model=model,
                    api_key=api_key,
                )

        return list(await asyncio.gather(*[_one(s) for s in segments]))

    async def close(self) -> None:
        await self._client.close()

    async def __aenter__(self) -> "TranslationRouter":
        return self

    async def __aexit__(self, *_) -> None:
        await self.close()
