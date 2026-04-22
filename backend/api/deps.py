"""FastAPI dependency functions shared across route modules."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db

DB = Annotated[AsyncSession, Depends(get_db)]
