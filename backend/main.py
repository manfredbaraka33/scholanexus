"""
ScholaNexus — FastAPI Entry Point
"""
import json
from typing import Dict, List

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.database import engine, Base

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ScholaNexus API",
    version="1.0.0",
    description="School Results Management System — Mujumuzi Golden Bridge Secondary School",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


# ── WebSocket Connection Manager ─────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, assessment_id: int):
        await websocket.accept()
        if assessment_id not in self.active_connections:
            self.active_connections[assessment_id] = []
        self.active_connections[assessment_id].append(websocket)

    def disconnect(self, websocket: WebSocket, assessment_id: int):
        connections = self.active_connections.get(assessment_id, [])
        if websocket in connections:
            connections.remove(websocket)

    async def broadcast(self, assessment_id: int, data: dict):
        """Send JSON data to all connected clients watching this assessment."""
        connections = self.active_connections.get(assessment_id, [])
        dead = []
        for ws in connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, assessment_id)


manager = ConnectionManager()


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ScholaNexus API"}
