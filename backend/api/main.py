"""OMI-TED FastAPI application entry point."""

from __future__ import annotations

import asyncio
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
log.info("Starting OMI-TED FastAPI application...")
log.info(f"Debug mode: {settings.debug}")
log.info(f"CORS origins: {settings.cors_origins}")


_db_init_task = None


async def _background_init_db():
    """Initialize database in background without blocking app startup."""
    from backend.db.init_db import init_db
    try:
        log.info("Background: starting database initialization...")
        await init_db()
        log.info("Background: database initialization completed")
    except Exception as exc:
        log.error("Background: database initialization failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db_init_task
    log.info("App startup: app is now ready to serve requests (DB init in background)")
    # Create a background task but don't await it - let it run in parallel
    _db_init_task = asyncio.create_task(_background_init_db())
    try:
        yield
    finally:
        log.info("App shutdown: cleaning up...")
        if _db_init_task and not _db_init_task.done():
            _db_init_task.cancel()
            try:
                await _db_init_task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="OMI-TED Translation Engine",
    description="Telugu → English transcript ingestion, LLM translation, and dubbing platform.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

log.info("App created, adding middleware...")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log.info("App middleware added, including routers...")
app.include_router(ingest.router, prefix="/api/v1")
app.include_router(translate.router, prefix="/api/v1")
app.include_router(dataset.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(models.router, prefix="/api/v1")
log.info("App routers included, app is ready!")


@app.get("/health", tags=["system"])
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}
