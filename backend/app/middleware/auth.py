"""Optional API key gate for single-user deployments."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import settings

_PUBLIC_PREFIXES = (
    "/api/health",
    "/api/indmoney/",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/",
)


class ApiKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        key = (settings.truewealth_api_key or "").strip()
        if not key:
            return await call_next(request)
        path = request.url.path
        if not path.startswith("/api"):
            return await call_next(request)
        if any(path.startswith(p) for p in _PUBLIC_PREFIXES):
            return await call_next(request)
        supplied = request.headers.get("x-api-key") or ""
        if not supplied and request.headers.get("authorization", "").lower().startswith("bearer "):
            supplied = request.headers.get("authorization", "")[7:].strip()
        if supplied != key:
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        return await call_next(request)
