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
        default="http://localhost:3000/",
        alias="FRONTEND_OAUTH_SUCCESS_URL",
        description="Browser redirect after OAuth callback (Next dev default; query indmoney_oauth=ok|error). Set to http://127.0.0.1:3000/ if you open the UI that way.",
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

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
