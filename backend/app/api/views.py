"""CRUD for portfolio views (single-user)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import (
    PortfolioViewCreate,
    PortfolioViewDTO,
    PortfolioViewUpdate,
    PortfolioViewsListResponse,
)
from app.services.portfolio_views import (
    create_view,
    get_active_view_id,
    list_views,
    reset_view_to_all,
    set_active_view,
    update_view,
)
from app.state import state

router = APIRouter()


def _to_dto(row) -> PortfolioViewDTO:
    from app.services.portfolio_views import parse_include_json

    return PortfolioViewDTO(
        id=row.id,
        name=row.name,
        include_asset_groups=parse_include_json(row.include_asset_groups),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/views", response_model=PortfolioViewsListResponse)
async def get_views(session: AsyncSession = Depends(get_session)) -> PortfolioViewsListResponse:
    rows = await list_views(session)
    aid = await get_active_view_id(session)
    return PortfolioViewsListResponse(views=[_to_dto(r) for r in rows], active_id=aid)


@router.post("/views", response_model=PortfolioViewDTO)
async def post_view(
    body: PortfolioViewCreate,
    session: AsyncSession = Depends(get_session),
) -> PortfolioViewDTO:
    row = await create_view(session, body.name, body.include_asset_groups)
    await state.rebuild_portfolio_cache(session)
    return _to_dto(row)


@router.put("/views/{view_id}", response_model=PortfolioViewDTO)
async def put_view(
    view_id: str,
    body: PortfolioViewUpdate,
    session: AsyncSession = Depends(get_session),
) -> PortfolioViewDTO:
    row = await update_view(session, view_id, name=body.name, include=body.include_asset_groups)
    if row is None:
        raise HTTPException(status_code=404, detail="View not found")
    await state.rebuild_portfolio_cache(session)
    return _to_dto(row)


@router.post("/views/active/{view_id}")
async def post_active_view(view_id: str, session: AsyncSession = Depends(get_session)) -> dict[str, bool]:
    ok = await set_active_view(session, view_id)
    if not ok:
        raise HTTPException(status_code=404, detail="View not found")
    await state.rebuild_portfolio_cache(session)
    return {"ok": True}


@router.post("/views/{view_id}/reset", response_model=PortfolioViewDTO)
async def post_reset_view(view_id: str, session: AsyncSession = Depends(get_session)) -> PortfolioViewDTO:
    row = await reset_view_to_all(session, view_id)
    if row is None:
        raise HTTPException(status_code=404, detail="View not found")
    await state.rebuild_portfolio_cache(session)
    return _to_dto(row)
