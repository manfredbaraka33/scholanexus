from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_teacher, get_current_user
from app.models.user import User
from app.services.results_engine import compile_class_results, get_submission_progress
from app.services.analytics import get_class_analytics

router = APIRouter(prefix="/results", tags=["results"])


@router.get("/progress")
async def submission_progress(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    return await get_submission_progress(assessment_id, db)


@router.get("/standings")
async def live_standings(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    return await compile_class_results(assessment_id, db)


@router.get("/analytics")
async def class_analytics(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    return await get_class_analytics(assessment_id, db)


@router.websocket("/live/{assessment_id}")
async def websocket_live(
    websocket: WebSocket,
    assessment_id: int,
    db: Session = Depends(get_db),
):
    from main import manager
    await manager.connect(websocket, assessment_id)
    # Send initial data on connect
    try:
        initial = await compile_class_results(assessment_id, db)
        await websocket.send_json(initial)
        while True:
            # Keep connection alive; client just listens for broadcasts
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, assessment_id)
    except Exception:
        manager.disconnect(websocket, assessment_id)
