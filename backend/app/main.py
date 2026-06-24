from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router as api_router
from app.config import settings
from app.database import SessionLocal
from app.middleware.auth import ApiKeyMiddleware
from app.state import state
from app.tasks.background import start_background_tasks

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    (_BACKEND_ROOT / "data").mkdir(parents=True, exist_ok=True)
    bg: list[asyncio.Task] = []
    try:
        async with SessionLocal() as session:
            await state.startup_discover(session)
            await state.refresh_holdings(session)
            await state.refresh_prices(session)
        bg = start_background_tasks()
        yield
    finally:
        for t in bg:
            t.cancel()
        if bg:
            await asyncio.gather(*bg, return_exceptions=True)


app = FastAPI(title="TRUE WEALTH API", version="1.0.0", lifespan=lifespan)
app.add_middleware(ApiKeyMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api")


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "truewealth", "docs": "/docs"}
