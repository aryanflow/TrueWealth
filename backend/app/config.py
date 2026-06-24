from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Documented by INDmoney as the same URL for every MCP client (Claude, Claude Code, etc.).
# Source: https://www.indmoney.com/mcp
INDMONEY_MCP_PUBLIC_URL = "https://mcp.indmoney.com/mcp"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    database_url: str = f"sqlite+aiosqlite:///{_BACKEND_ROOT / 'data' / 'truewealth.db'}"
    mcp_endpoint: str = Field(
        default=INDMONEY_MCP_PUBLIC_URL,
        alias="INDMONEY_MCP_URL",
        description="INDmoney streamable HTTP MCP endpoint (official default if env unset).",
    )
    # Optional: some deployments use a proxy that forwards OAuth; others accept Bearer after sign-in.
    # Raw INDmoney cloud URL without a token typically returns 401 — see README “Live data”.
    mcp_bearer_token: Optional[str] = Field(
        default=None,
        alias="INDMONEY_MCP_BEARER_TOKEN",
        description="If set, sent as Authorization: Bearer <token> on every MCP JSON-RPC POST.",
    )
    mcp_timeout_sec: float = 30.0
    # OAuth callback and post-login browser redirect (single-user local defaults).
    api_public_base_url: str = Field(
        default="http://127.0.0.1:8000",
        alias="TRUEWEALTH_API_PUBLIC_BASE",
        description="Public base URL of this FastAPI app (must match registered redirect URI host/port).",
    )
    indmoney_oauth_issuer: str = Field(
        default="https://mcp.indmoney.com",
        alias="INDMONEY_OAUTH_ISSUER",
        description="INDmoney MCP OAuth issuer (authorization server metadata host).",
    )
    frontend_oauth_success_url: str = Field(
        default="http://localhost:3000/today",
        alias="FRONTEND_OAUTH_SUCCESS_URL",
        description="Browser redirect after OAuth callback (path should match your Next app, e.g. /today).",
    )
    indmoney_oauth_client_name: str = Field(
        default="True Wealth",
        alias="INDMONEY_OAUTH_CLIENT_NAME",
        description="Dynamic client registration display name.",
    )
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    concentration_threshold_pct: float = 15.0
    price_refresh_sec: int = 10
    holdings_refresh_sec: int = 120
    alerts_refresh_sec: int = 60
    heartbeat_sec: int = 15
    usdinr_rate: float = Field(
        default=94.61,
        alias="USDINR_RATE",
        description="Static USD/INR spot for converting US book to INR when broker INR book is absent (override via env).",
    )
    ohlc_enrich_max: int = Field(default=5, alias="OHLC_ENRICH_MAX", ge=0, le=30, description="Max MCP OHLC calls per price refresh for day-move proxy.")
    mf_lab_max_mcp_calls: int = Field(
        default=8,
        alias="MF_LAB_MAX_MCP_CALLS",
        ge=0,
        le=50,
        description="Cap MCP get_mf_funds_details calls per holdings refresh so the book and /api/portfolio stay responsive.",
    )
    reconciliation_debug_logging: bool = Field(
        default=False,
        alias="TW_RECONCILIATION_DEBUG",
        description="When true, emit extra reconciliation summary logs (book lines, INR sum). Off by default.",
    )
    holdings_raw_preview_logging: bool = Field(
        default=False,
        alias="TW_HOLDINGS_RAW_PREVIEW",
        description="Log first MCP row key names (no values) after holdings fetch — for mapping issues.",
    )
    truewealth_api_key: Optional[str] = Field(
        default=None,
        alias="TRUEWEALTH_API_KEY",
        description="If set, require X-API-Key or Bearer on /api/* (except health and OAuth callback).",
    )
    fx_live_url: str = Field(
        default="https://api.frankfurter.dev/v1/latest?from=USD&to=INR",
        alias="FX_LIVE_URL",
        description="HTTP JSON endpoint for live USD/INR; empty disables live fetch.",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
