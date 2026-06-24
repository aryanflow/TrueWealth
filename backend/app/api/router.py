from fastapi import APIRouter

from app.api import health, holdings, indmoney_auth, mcp, mf, portfolio, rules, stream, views

router = APIRouter()
router.include_router(health.router, tags=["health"])
router.include_router(portfolio.router, tags=["portfolio"])
router.include_router(holdings.router, tags=["holdings"])
router.include_router(stream.router, tags=["stream"])
router.include_router(rules.router, tags=["rules"])
router.include_router(mcp.router, tags=["mcp"])
router.include_router(mf.router, tags=["mf"])
router.include_router(views.router, tags=["views"])
router.include_router(indmoney_auth.router, tags=["indmoney-oauth"])
