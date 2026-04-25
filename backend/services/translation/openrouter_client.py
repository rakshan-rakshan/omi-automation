"""
OpenRouter API client for multi-model LLM calls.

OpenRouter provides a unified endpoint compatible with the OpenAI SDK.
All three tiers (best / good / cheap) go through the same client — only
the model ID changes.

Rate limiting and retries are handled here so callers get clean results.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from backend.config import settings

logger = logging.getLogger(__name__)

_OPENROUTER_BASE = "https://openrouter.ai/api/v1"


@dataclass
class LLMResponse:
    model: str
    text: str
    tokens_input: int
    tokens_output: int
    cost_usd: float
    latency_ms: int
    prompt_version: str = ""
    raw: dict = field(default_factory=dict)


class OpenRouterClient:
    """
    Async HTTP client for OpenRouter.

    Usage:
        client = OpenRouterClient()
        response = await client.complete(
            model="anthropic/claude-opus-4-7",
            system_prompt="...",
            user_message="...",
        )
    """

    def __init__(self, api_key: Optional[str] = None, timeout: float = 60.0):
        self._api_key = api_key or settings.openrouter_api_key
        self._timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        """Lazily initialize the AsyncClient on first use."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=_OPENROUTER_BASE,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "HTTP-Referer": "https://omited.ophir.org",
                    "X-Title": "OMI-TED Translation Engine",
                    "Content-Type": "application/json",
                },
                timeout=httpx.Timeout(self._timeout),
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    @retry(
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=16),
        reraise=True,
    )
    async def complete(
        self,
        model: str,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
        prompt_version: str = "",
        api_key: Optional[str] = None,
    ) -> LLMResponse:
        """
        Send a chat completion request to OpenRouter.

        api_key overrides the default server key — used when the caller
        supplies their own OpenRouter key from the frontend.
        """
        t0 = time.monotonic()
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        extra_headers = {"Authorization": f"Bearer {api_key}"} if api_key else None

        client = self._get_client()
        resp = await client.post("/chat/completions", json=payload, headers=extra_headers)

        if resp.status_code != 200:
            logger.error(
                "OpenRouter %s error %d: %s",
                model, resp.status_code, resp.text[:500],
            )
            resp.raise_for_status()

        data = resp.json()
        latency_ms = int((time.monotonic() - t0) * 1000)

        choice = data["choices"][0]
        usage = data.get("usage", {})

        cost = 0.0
        if "usage" in data and "cost" in data["usage"]:
            cost = float(data["usage"]["cost"])

        return LLMResponse(
            model=data.get("model", model),
            text=choice["message"]["content"].strip(),
            tokens_input=usage.get("prompt_tokens", 0),
            tokens_output=usage.get("completion_tokens", 0),
            cost_usd=cost,
            latency_ms=latency_ms,
            prompt_version=prompt_version,
            raw=data,
        )

    async def fetch_available_models(self, api_key: Optional[str] = None) -> list:
        """Fetch all models available on OpenRouter."""
        key = api_key or self._api_key
        async with httpx.AsyncClient(timeout=15.0) as c:
            resp = await c.get(
                f"{_OPENROUTER_BASE}/models",
                headers={"Authorization": f"Bearer {key}"},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("data", [])

    async def __aenter__(self) -> "OpenRouterClient":
        return self

    async def __aexit__(self, *_) -> None:
        await self.close()
