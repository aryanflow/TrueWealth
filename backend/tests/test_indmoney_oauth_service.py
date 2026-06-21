from __future__ import annotations

import pytest

from app.services import indmoney_oauth_service as imo
from app.services.indmoney_oauth_service import (
    ALLOWED_SCOPES,
    DEFAULT_SCOPE,
    parse_scope_param,
    redirect_uri_for_api,
    validate_oauth_return_base,
)


def test_parse_scope_default() -> None:
    assert parse_scope_param(None) == DEFAULT_SCOPE
    assert parse_scope_param("") == DEFAULT_SCOPE


def test_parse_scope_single() -> None:
    assert parse_scope_param("portfolio:read") == "portfolio:read"


def test_parse_scope_pair() -> None:
    assert parse_scope_param("portfolio:read market:read") == "portfolio:read market:read"


def test_parse_scope_rejects_unknown() -> None:
    with pytest.raises(ValueError, match="Unsupported"):
        parse_scope_param("openid")


def test_allowed_scopes_nonempty() -> None:
    assert "portfolio:read" in ALLOWED_SCOPES


def test_redirect_uri_for_api_has_callback_suffix() -> None:
    assert redirect_uri_for_api().endswith("/api/indmoney/auth/callback")


def test_validate_return_base_rejects_unknown_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(imo.settings, "frontend_oauth_success_url", "http://127.0.0.1:3000/")
    monkeypatch.setattr(imo.settings, "cors_origins", "http://localhost:3000")
    assert validate_oauth_return_base("http://evil.example/") is None


def test_validate_return_base_accepts_frontend_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(imo.settings, "frontend_oauth_success_url", "http://127.0.0.1:3000/foo")
    monkeypatch.setattr(imo.settings, "cors_origins", "")
    assert validate_oauth_return_base("http://127.0.0.1:3000/dashboard") == "http://127.0.0.1:3000/dashboard"


def test_validate_return_base_accepts_cors_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(imo.settings, "frontend_oauth_success_url", "http://127.0.0.1:3000/")
    monkeypatch.setattr(imo.settings, "cors_origins", "http://localhost:3000")
    assert validate_oauth_return_base("http://localhost:3000/") == "http://localhost:3000/"
