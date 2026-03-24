"""
WebSocket endpoint for real-time signal broadcasting.

Clients connect via:
  ws://host/ws/signals?token=<JWT>

The token is validated on connect. Invalid tokens result in WebSocket close
with code 4001 (application-level auth rejection).
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from backend.auth.service import decode_token
from backend.signals.broadcaster import broadcaster

router = APIRouter()


@router.websocket("/ws/signals")
async def ws_signals(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    """WebSocket endpoint that streams signal updates to authenticated clients."""
    try:
        decode_token(token)
    except Exception:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    broadcaster.connect(websocket)
    try:
        while True:
            # Keep the connection alive; client messages are ignored
            await websocket.receive_text()
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
    finally:
        broadcaster.disconnect(websocket)
