from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_teacher, get_current_user
from app.models.user import User
from app.models.score import Score
from app.models.student import Student
from app.models.assessment import Assessment
from app.schemas.score import ScoreSaveRequest, ScoreResponse
from app.utils.necta import marks_to_grade, grade_to_points

router = APIRouter(prefix="/scores", tags=["scores"])


def _upsert_scores(
    assessment_id: int,
    subject_id: int,
    scores_data: list,
    user_id: int,
    is_submitted: bool,
    db: Session,
) -> List[Score]:
    """Create or update score records."""
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check if already locked (any score submitted by any teacher for this subject+assessment)
    if not is_submitted:
        locked = db.query(Score).filter(
            Score.assessment_id == assessment_id,
            Score.subject_id == subject_id,
            Score.is_submitted == True,
        ).first()
        if locked:
            raise HTTPException(status_code=400, detail="Score sheet already submitted and locked")

    result_scores = []
    for item in scores_data:
        student_id = item.student_id
        marks = item.marks

        grade = marks_to_grade(marks) if marks is not None else None
        points = grade_to_points(grade) if grade is not None else None

        score = db.query(Score).filter(
            Score.student_id == student_id,
            Score.subject_id == subject_id,
            Score.assessment_id == assessment_id,
        ).first()

        if score:
            if score.is_submitted and not is_submitted:
                # Already submitted, skip update
                result_scores.append(score)
                continue
            score.marks = marks
            score.grade = grade
            score.points = points
            score.submitted_by = user_id
            if is_submitted:
                score.is_submitted = True
                score.submitted_at = datetime.utcnow()
        else:
            score = Score(
                student_id=student_id,
                subject_id=subject_id,
                assessment_id=assessment_id,
                marks=marks,
                grade=grade,
                points=points,
                submitted_by=user_id,
                is_submitted=is_submitted,
                submitted_at=datetime.utcnow() if is_submitted else None,
            )
            db.add(score)
        result_scores.append(score)

    db.commit()
    for s in result_scores:
        db.refresh(s)
    return result_scores


@router.put("/save", response_model=List[ScoreResponse])
def save_scores(
    payload: ScoreSaveRequest,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Auto-save scores without submitting."""
    return _upsert_scores(
        payload.assessment_id,
        payload.subject_id,
        payload.scores,
        current_user.id,
        is_submitted=False,
        db=db,
    )


@router.post("/submit", response_model=List[ScoreResponse])
async def submit_scores(
    payload: ScoreSaveRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Submit and lock a score sheet. Triggers live broadcast."""
    scores = _upsert_scores(
        payload.assessment_id,
        payload.subject_id,
        payload.scores,
        current_user.id,
        is_submitted=True,
        db=db,
    )

    # Trigger WebSocket broadcast in background
    background_tasks.add_task(
        _broadcast_results, payload.assessment_id, db
    )

    return scores


async def _broadcast_results(assessment_id: int, db: Session):
    """Broadcast updated results to all connected WebSocket clients."""
    try:
        from app.services.results_engine import compile_class_results
        from main import manager
        results = await compile_class_results(assessment_id, db)
        await manager.broadcast(assessment_id, results)
    except Exception:
        pass  # Don't fail the request if broadcast fails
