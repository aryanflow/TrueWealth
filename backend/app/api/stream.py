from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.state import state

router = APIRouter()


@router.get("/stream")
async def stream() -> StreamingResponse:
    async def event_gen() -> AsyncIterator[str]:
        async for channel, env in state.hub.subscribe():
            yield state.hub.sse_format(channel, env)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_gen(), media_type="text/event-stream", headers=headers)
