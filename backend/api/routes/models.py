"""
Model registry API routes.

GET  /models                List registered models from DB
GET  /models/{id}           Get single model details
GET  /models/available      Proxy OpenRouter's full model catalog
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import text

from backend.api.deps import DB
from backend.services.translation.openrouter_client import OpenRouterClient

router = APIRouter(prefix="/models", tags=["models"])

_or_client = OpenRouterClient()


@router.get("/available", summary="List all models available on OpenRouter")
async def list_available_models(
    provider: Optional[str] = None,
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
):
    """
    Proxies the OpenRouter /models endpoint.
    Optionally filter by provider slug (e.g. ?provider=google).
    Pass X-Api-Key header to use your own OpenRouter key.
    """
    try:
        models = await _or_client.fetch_available_models(api_key=x_api_key)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenRouter error: {exc}")

    # Normalise to a flat list with the fields the frontend needs
    result = []
    for m in models:
        model_id = m.get("id", "")
        # Derive provider from model ID prefix (e.g. "google/gemma-2-9b-it" → "google")
        inferred_provider = model_id.split("/")[0] if "/" in model_id else "other"
        if provider and inferred_provider.lower() != provider.lower():
            continue
        pricing = m.get("pricing", {})
        result.append({
            "id": model_id,
            "name": m.get("name", model_id),
            "provider": inferred_provider,
            "context_length": m.get("context_length"),
            "cost_input_per_1k": round(float(pricing.get("prompt", 0)) * 1000, 6),
            "cost_output_per_1k": round(float(pricing.get("completion", 0)) * 1000, 6),
        })

    result.sort(key=lambda x: (x["provider"], x["name"]))
    return result


@router.get("", summary="List all registered models")
async def list_models(db: DB):
    result = await db.execute(text("""
        SELECT
            model_id::text, model_name, display_name, provider,
            model_type::text, tier::text,
            is_active, supports_telugu,
            cost_per_1k_input_tokens, cost_per_1k_output_tokens,
            max_tokens, context_window
        FROM model_registry
        ORDER BY model_type, tier NULLS LAST, provider, model_name
    """))
    return [dict(r) for r in result.mappings()]


@router.get("/{model_id}", summary="Get model details")
async def get_model(model_id: str, db: DB):
    result = await db.execute(
        text("""
            SELECT model_id::text, model_name, display_name, provider,
                   model_type::text, tier::text, is_active, supports_telugu,
                   cost_per_1k_input_tokens, cost_per_1k_output_tokens,
                   max_tokens, context_window, api_key_env_var, notes
            FROM model_registry WHERE model_id = :mid::uuid
        """),
        {"mid": model_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    return dict(row)
