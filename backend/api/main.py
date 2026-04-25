"""OMI-TED FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.api.routes import ingest, translate, dataset, reports, models

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.db.init_db import init_db
    try:
        await init_db()
        log.info("Database initialization completed")
    except Exception as exc:
        log.error("Database initialization failed: %s", exc)
    yield


app = FastAPI(
    title="OMI-TED Translation Engine",
    description="Telugu → English transcript ingestion, LLM translation, and dubbing platform.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/api/v1")
app.include_router(translate.router, prefix="/api/v1")
app.include_router(dataset.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(models.router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}
