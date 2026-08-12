import asyncio
import json
from typing import Dict, List, Any
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # tenant_slug -> list of WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # We can also map user_id to WebSocket if we want targeted messages, but for now tenant level is good
        self.user_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, tenant_slug: str, user_id: str):
        await websocket.accept()
        
        if tenant_slug not in self.active_connections:
            self.active_connections[tenant_slug] = []
        self.active_connections[tenant_slug].append(websocket)
        
        self.user_connections[user_id] = websocket
        logger.info(f"Client #{user_id} connected to tenant {tenant_slug}")

    def disconnect(self, websocket: WebSocket, tenant_slug: str, user_id: str):
        if tenant_slug in self.active_connections:
            if websocket in self.active_connections[tenant_slug]:
                self.active_connections[tenant_slug].remove(websocket)
            if not self.active_connections[tenant_slug]:
                del self.active_connections[tenant_slug]
                
        if user_id in self.user_connections:
            del self.user_connections[user_id]
            
        logger.info(f"Client #{user_id} disconnected from tenant {tenant_slug}")

    async def send_personal_message(self, message: str, user_id: str):
        websocket = self.user_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")

    async def broadcast(self, tenant_slug: str, message: Any):
        if tenant_slug not in self.active_connections:
            return
            
        text_message = json.dumps(message, default=str) if isinstance(message, dict) else message
        
        # Create a list of tasks to send to all connected clients concurrently
        disconnected = []
        for connection in self.active_connections[tenant_slug]:
            try:
                await connection.send_text(text_message)
            except Exception as e:
                logger.error(f"Error broadcasting to a client in {tenant_slug}: {e}")
                disconnected.append(connection)
                
        # Clean up any dead connections
        for dead_conn in disconnected:
            if dead_conn in self.active_connections[tenant_slug]:
                self.active_connections[tenant_slug].remove(dead_conn)

manager = ConnectionManager()
