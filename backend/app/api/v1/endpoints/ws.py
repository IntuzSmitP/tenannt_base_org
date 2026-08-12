import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException
from jose import jwt, JWTError
from app.core.config import settings
from app.core.websockets import manager
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

# Note: We can't easily use standard Depends(get_current_user) in WebSocket because headers aren't easily sent from browser JS WS API.
# Common practice is to send token in query params.
async def get_ws_current_user_id(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except JWTError:
        return None

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, 
    token: str = Query(..., description="JWT token for authentication"),
    tenant: str = Query(..., description="Tenant slug")
):
    user_id = await get_ws_current_user_id(token)
    if not user_id:
        await websocket.close(code=1008, reason="Invalid token")
        return
        
    await manager.connect(websocket, tenant, user_id)
    
    try:
        while True:
            # We don't really expect clients to send messages, but we keep the loop alive to listen for disconnects
            # If clients do send messages, we can handle them here
            data = await websocket.receive_text()
            # We could echo or handle client-sent events here
            # await manager.send_personal_message(f"You wrote: {data}", user_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, tenant, user_id)
